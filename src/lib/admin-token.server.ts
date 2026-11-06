/** Admin-only access for the backup endpoints.
 *  The legacy site keeps its accounts inside the shared `luxen_all_users` blob,
 *  so admin identity is verified server-side against that blob (never trusting
 *  the browser), and a short-lived signed token is issued for backup calls. */
import { readStoreKey } from "./site-store.server";
import { verifyRecordPassword } from "./auth.server";

const enc = new TextEncoder();

function secret(): string {
  return (
    process.env["LOVABLE_CRON_SECRET"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_URL"] ||
    "elevate-fallback-secret"
  );
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TTL_MS = 12 * 60 * 60 * 1000;

export async function issueAdminToken(username: string): Promise<string> {
  const payload = `${username}|${Date.now() + TTL_MS}`;
  return `${btoa(unescape(encodeURIComponent(payload)))}.${await hmac(payload)}`;
}

export async function verifyAdminToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return false;
  let payload: string;
  try {
    payload = decodeURIComponent(escape(atob(encoded)));
  } catch {
    return false;
  }
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  const expiry = Number(payload.split("|")[1]);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

/** Whose name the token carries. Only useful after verifyAdminToken returned true. */
export function adminTokenSubject(token: string | null | undefined): string {
  if (!token || typeof token !== "string" || !token.includes(".")) return "";
  try {
    return decodeURIComponent(escape(atob(token.split(".")[0]))).split("|")[0] || "";
  } catch {
    return "";
  }
}

/** Verify admin credentials against the server-side copy of the users blob. */
export async function checkAdminCredentials(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; username?: string }> {
  if (!identifier || !password) return { ok: false };
  const users = await readStoreKey("luxen_all_users");
  if (!Array.isArray(users)) return { ok: false };
  const id = identifier.trim().toLowerCase();
  const match = users.find((u) => {
    if (!u || typeof u !== "object") return false;
    const rec = u as Record<string, unknown>;
    const names = [rec["username"], rec["email"]]
      .filter((v) => typeof v === "string")
      .map((v) => (v as string).trim().toLowerCase());
    return names.includes(id) && rec["isAdmin"] === true;
  }) as Record<string, unknown> | undefined;
  if (!match) return { ok: false };
  const { ok } = await verifyRecordPassword(match, password);
  if (!ok) return { ok: false };
  return { ok: true, username: String(match["username"] ?? identifier) };
}
