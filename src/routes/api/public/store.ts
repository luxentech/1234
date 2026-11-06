import { createFileRoute } from "@tanstack/react-router";
import {
  ALLOWED_KEYS,
  ALLOWED_KEY_SET,
  ADMIN_ONLY_KEYS,
  MERGE_ONLY_KEYS,
  getClient,
  getFallbackClient,
  getAllLocalMemoryStore,
  setLocalMemoryStore,
  hasConfig,
  json,
  mergeValues,
  readStoreKey,
  redactUsers,
  writeStoreKey,
} from "@/lib/site-store.server";
import { sanitizeIncomingUsers } from "@/lib/auth.server";
import { verifyAdminToken } from "@/lib/admin-token.server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit.server";
import { sanitizePayload } from "@/lib/sanitize.server";

export const Route = createFileRoute("/api/public/store")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};

        // 1. Try fetching from Supabase
        let remoteRows: { key: string; value: unknown }[] | null = null;
        try {
          const { data, error } = await getClient().from("site_store").select("key,value");
          if (!error && data) remoteRows = data;
        } catch (e) {
          try {
            const fb = getFallbackClient();
            if (fb) {
              const { data, error } = await fb.from("site_store").select("key,value");
              if (!error && data) remoteRows = data;
            }
          } catch {}
        }

        if (remoteRows && remoteRows.length > 0) {
          for (const row of remoteRows) {
            if (!ALLOWED_KEY_SET.has(row.key)) continue;
            setLocalMemoryStore(row.key, row.value);
            out[row.key] = row.key === "luxen_all_users" ? redactUsers(row.value) : row.value;
          }
        } else {
          // If remote fails or is empty, serve from resilient local store (never 500 error!)
          const localAll = getAllLocalMemoryStore();
          for (const [k, v] of Object.entries(localAll)) {
            if (!ALLOWED_KEY_SET.has(k)) continue;
            out[k] = k === "luxen_all_users" ? redactUsers(v) : v;
          }
        }

        return json({ data: out });
      },

      POST: async ({ request }) => {
        // High rate limit threshold to ensure user/admin operations are never blocked
        const ip = getClientIp(request);
        const rate = checkRateLimit(ip, {
          windowMs: 60 * 1000,
          maxRequests: 5000,
          keyPrefix: "store",
        });
        if (!rate.allowed) {
          return json({ error: "تم تجاوز حد الطلبات المسموح به مؤقتاً، يرجى الانتظار." }, 429);
        }

        let body: { key?: string; value?: unknown; deletedIds?: string[] };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const key = typeof body.key === "string" ? body.key : "";
        if (!ALLOWED_KEY_SET.has(key)) return json({ error: "Unknown key" }, 400);
        if (body.value === undefined) return json({ error: "Missing value" }, 400);

        const deletedIds = Array.isArray(body.deletedIds)
          ? body.deletedIds.map(String)
          : undefined;

        // Protection for Admin-only keys (cards, partners, settings, faq, status)
        if (ADMIN_ONLY_KEYS.has(key)) {
          const authHeader =
            request.headers.get("x-admin-token") ||
            (request.headers.get("authorization")?.startsWith("Bearer ")
              ? request.headers.get("authorization")?.slice(7)
              : "");

          if (!authHeader || !(await verifyAdminToken(authHeader))) {
            return json({ error: "هذا الإجراء محمي ويتطلب صلاحيات الإدارة الكاملة." }, 403);
          }

          // Anti-catastrophic wipe safeguard: prevent erasing existing cards/partners completely
          if (
            (key === "luxen_general_cards" || key === "luxen_partners") &&
            Array.isArray(body.value) &&
            body.value.length === 0
          ) {
            const existing = await readStoreKey(key);
            if (Array.isArray(existing) && existing.length > 0) {
              return json(
                { error: "تم حظر العملية: لا يمكن مسح كل السجلات دفعة واحدة لحماية البيانات." },
                400,
              );
            }
          }
        }

        // Sanitize incoming payload recursively against XSS
        let incoming: unknown = sanitizePayload(body.value);
        if (key === "luxen_all_users") incoming = await sanitizeIncomingUsers(incoming);

        let next: unknown = incoming;
        if (MERGE_ONLY_KEYS.has(key)) {
          const existing = await readStoreKey(key);
          next = mergeValues(key, existing, incoming, deletedIds);
        } else if (deletedIds && Array.isArray(next)) {
          const delSet = new Set(deletedIds);
          next = next.filter((item) => {
            if (typeof item === "object" && item !== null) {
              const obj = item as Record<string, unknown>;
              for (const f of ["id", "_id", "uid", "key", "slug", "username", "email"]) {
                if (obj[f] !== undefined && delSet.has(String(obj[f]))) return false;
              }
            }
            return true;
          });
        }

        try {
          await writeStoreKey(key, next, "site");
        } catch (e) {
          // writeStoreKey already saves to local store, but just in case
          setLocalMemoryStore(key, next);
        }
        return json({ ok: true });
      },
    },
  },
});
