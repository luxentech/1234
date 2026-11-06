import { createFileRoute } from "@tanstack/react-router";
import {
  ALLOWED_KEYS,
  ALLOWED_KEY_SET,
  getClient,
  hasConfig,
  json,
  mergeValues,
  writeStoreKey,
} from "@/lib/site-store.server";
import { checkAdminCredentials, issueAdminToken, verifyAdminToken } from "@/lib/admin-token.server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit.server";

async function readAll(): Promise<Record<string, unknown>> {
  const { data, error } = await getClient().from("site_store").select("key,value");
  if (error) throw new Error(error.message);
  const out: Record<string, unknown> = {};
  for (const row of data ?? []) {
    if (ALLOWED_KEY_SET.has(row.key)) out[row.key] = row.value;
  }
  return out;
}

export const Route = createFileRoute("/api/public/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasConfig()) return json({ error: "Server configuration missing" }, 500);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const action = String(body["action"] ?? "");

        if (action === "token") {
          const ip = getClientIp(request);
          const rate = checkRateLimit(ip, {
            windowMs: 60 * 1000,
            maxRequests: 5,
            keyPrefix: "bk-token",
          });
          if (!rate.allowed) {
            return json(
              { error: "محاولات كثيرة جداً للحصول على صلاحيات الإدارة. يرجى الانتظار." },
              429,
            );
          }

          const res = await checkAdminCredentials(
            String(body["identifier"] ?? ""),
            String(body["password"] ?? ""),
          );
          if (!res.ok) return json({ error: "بيانات المدير غير صحيحة" }, 401);
          return json({ token: await issueAdminToken(res.username!) });
        }

        if (!(await verifyAdminToken(String(body["token"] ?? "")))) {
          return json({ error: "Unauthorized" }, 401);
        }

        if (action === "export") {
          try {
            return json({
              exported_at: new Date().toISOString(),
              version: 1,
              data: await readAll(),
            });
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Export failed" }, 500);
          }
        }

        if (action === "import") {
          const incoming = body["data"];
          if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
            return json({ error: "ملف غير صالح" }, 400);
          }
          let existing: Record<string, unknown>;
          try {
            existing = await readAll();
          } catch (e) {
            return json({ error: e instanceof Error ? e.message : "Read failed" }, 500);
          }
          const merged: string[] = [];
          for (const key of ALLOWED_KEYS) {
            const value = (incoming as Record<string, unknown>)[key];
            if (value === undefined || value === null) continue;
            // Every key is merged on import: nothing existing is ever removed,
            // and duplicates collapse on their identity (id / username / email).
            const next = mergeValues(key, existing[key] ?? null, value);
            try {
              await writeStoreKey(key, next, "backup-import");
              merged.push(key);
            } catch (e) {
              return json(
                { error: `${key}: ${e instanceof Error ? e.message : "Write failed"}` },
                500,
              );
            }
          }
          return json({ ok: true, merged });
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
