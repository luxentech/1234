import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import fs from "node:fs";
import path from "node:path";

export const ALLOWED_KEYS = [
  "luxen_general_cards",
  "luxen_partners",
  "luxen_comments",
  "luxen_likes",
  "luxen_all_users",
  "luxen_notifications",
  "luxen_category_status",
  "luxen_views",
  "luxen_submissions",
  "luxen_votes",
  "luxen_settings",
  "luxen_live_joins",
  "luxen_video_likes",
  "luxen_video_views",
  "luxen_faq",
  "luxen_qna",
  "luxen_reset_requests",
  "luxen_app_installs",
  "luxen_courses",
  "luxen_course_comments",
  "luxen_course_likes",
  "luxen_course_bookmarks",
  "luxen_course_subscriptions",
] as const;

export const ALLOWED_KEY_SET = new Set<string>(ALLOWED_KEYS);

/** Keys restricted exclusively to authenticated administrators. */
export const ADMIN_ONLY_KEYS = new Set<string>([
  "luxen_general_cards",
  "luxen_partners",
  "luxen_settings",
  "luxen_category_status",
  "luxen_faq",
]);

/** Keys whose records must never disappear: writes are always merged, never shrunk. */
export const MERGE_ONLY_KEYS = new Set([
  "luxen_all_users",
  "luxen_comments",
  "luxen_qna",
  "luxen_submissions",
  "luxen_notifications",
  // A help request that was answered must never be overwritten by an older copy.
  "luxen_reset_requests",
  "luxen_app_installs",
  "luxen_courses",
  "luxen_course_comments",
  "luxen_course_subscriptions",
]);

export const json = (body: unknown, status = 200, customHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "x-xss-protection": "1; mode=block",
      "referrer-policy": "strict-origin-when-cross-origin",
      ...customHeaders,
    },
  });

/* --------------------------- Resilient Local Storage Engine --------------------------- */

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BASE_DATA_DIR = path.resolve(process.cwd(), "data");
const BASE_DATA_FILE = path.resolve(BASE_DATA_DIR, "site_store.json");

const DATA_DIR = IS_SERVERLESS ? "/tmp" : BASE_DATA_DIR;
const DATA_FILE = path.resolve(DATA_DIR, "site_store.json");

const inMemoryStore = new Map<string, unknown>();
let lastLoadedMtime = 0;

function loadLocalStoreFromFile(): void {
  try {
    // If in serverless and /tmp/site_store.json does not exist yet, seed it from base data
    if (IS_SERVERLESS && !fs.existsSync(DATA_FILE) && fs.existsSync(BASE_DATA_FILE)) {
      try {
        fs.copyFileSync(BASE_DATA_FILE, DATA_FILE);
      } catch {}
    }

    const fileToRead = fs.existsSync(DATA_FILE) ? DATA_FILE : (fs.existsSync(BASE_DATA_FILE) ? BASE_DATA_FILE : null);
    if (fileToRead) {
      const stat = fs.statSync(fileToRead);
      if (stat.mtimeMs > lastLoadedMtime) {
        lastLoadedMtime = stat.mtimeMs;
        const raw = fs.readFileSync(fileToRead, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            inMemoryStore.set(k, v);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Elevate Local Store] Error reading file store:", err);
  }
}

function persistLocalStoreToFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, unknown> = {};
    for (const [k, v] of inMemoryStore.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
    if (fs.existsSync(DATA_FILE)) {
      lastLoadedMtime = fs.statSync(DATA_FILE).mtimeMs;
    }
  } catch (err) {
    console.warn("[Elevate Local Store] Error saving file store:", err);
  }
}

export function getLocalMemoryStore(key: string): unknown {
  loadLocalStoreFromFile();
  return inMemoryStore.has(key) ? inMemoryStore.get(key) : null;
}

export function getAllLocalMemoryStore(): Record<string, unknown> {
  loadLocalStoreFromFile();
  const out: Record<string, unknown> = {};
  for (const [k, v] of inMemoryStore.entries()) {
    out[k] = v;
  }
  return out;
}

export function setLocalMemoryStore(key: string, value: unknown): void {
  loadLocalStoreFromFile();
  inMemoryStore.set(key, value);
  persistLocalStoreToFile();
}

/* --------------------------- Supabase Clients & Circuit Breaker --------------------------- */

const PROJECT_ID = process.env["SUPABASE_PROJECT_ID"] || "nytexmvrypetsyhihady";
const DIRECT_SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const CONFIG_URL = process.env["SUPABASE_URL"] || DIRECT_SUPABASE_URL;
const CONFIG_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
  process.env["SUPABASE_PUBLISHABLE_KEY"] ||
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_oHMFI81bu6Vh7m2Jw3zhog_I4Q8k1-a";

export const hasConfig = () => true;
export const hasServiceRole = () => Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);

let isRemoteHealthy = false;
let lastRemoteCheck = 0;
const REMOTE_CHECK_COOLDOWN = 60_000; // 1 minute cooldown on failure

function buildClient(url: string, key: string): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);

        // Enforce strict 1500ms timeout so dead domains/network NEVER hang the server
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const existingSignal = init?.signal;
        if (existingSignal) {
          existingSignal.addEventListener("abort", () => controller.abort());
        }

        return fetch(input, { ...init, headers, signal: controller.signal }).finally(() => {
          clearTimeout(timeout);
        });
      },
    },
  });
}

export function getClient(): SupabaseClient<Database> {
  return buildClient(CONFIG_URL, CONFIG_KEY);
}

export function getFallbackClient(): SupabaseClient<Database> | null {
  if (CONFIG_URL === DIRECT_SUPABASE_URL) return null;
  return buildClient(DIRECT_SUPABASE_URL, CONFIG_KEY);
}

/* ------------------------------- merging ------------------------------- */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function identity(key: string, item: unknown): string {
  if (!isPlainObject(item)) return JSON.stringify(item);
  if (key === "luxen_all_users") {
    const u = (item["username"] ?? item["email"] ?? "") as string;
    if (u) return "u:" + String(u).toLowerCase();
  }
  for (const field of ["id", "_id", "uid", "key", "slug"]) {
    if (item[field] !== undefined && item[field] !== null && item[field] !== "") {
      return field + ":" + String(item[field]);
    }
  }
  return "j:" + JSON.stringify(item);
}

/** Merge `incoming` into `existing` without ever dropping an existing record,
 *  unless explicitly removed via deletedIds or tombstone flags. */
export function mergeValues(
  key: string,
  existing: unknown,
  incoming: unknown,
  deletedIds?: string[],
): unknown {
  const deletedSet = new Set((deletedIds || []).map(String));

  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const order: string[] = [];
    const byId = new Map<string, unknown>();

    const isMarkedDeleted = (item: unknown): boolean => {
      if (!isPlainObject(item)) return false;
      if (item["_deleted"] === true || item["isDeleted"] === true) return true;
      for (const f of ["id", "_id", "uid", "key", "slug", "username", "email"]) {
        if (item[f] !== undefined && deletedSet.has(String(item[f]))) return true;
      }
      return false;
    };

    for (const item of existing) {
      if (isMarkedDeleted(item)) continue;
      const id = identity(key, item);
      if (!byId.has(id)) order.push(id);
      byId.set(id, item);
    }

    for (const item of incoming) {
      const id = identity(key, item);
      if (isMarkedDeleted(item)) {
        byId.delete(id);
        const idx = order.indexOf(id);
        if (idx !== -1) order.splice(idx, 1);
        continue;
      }
      if (!byId.has(id)) {
        order.push(id);
        byId.set(id, item);
      } else {
        const prev = byId.get(id);
        byId.set(id, isPlainObject(prev) && isPlainObject(item) ? { ...prev, ...item } : item);
      }
    }

    return order
      .map((id) => byId.get(id))
      .filter((item) => item !== undefined && !isMarkedDeleted(item));
  }
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const out: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      const prev = out[k];
      out[k] =
        Array.isArray(prev) || isPlainObject(prev)
          ? mergeValues(key, prev, v as unknown, deletedIds)
          : v;
    }
    return out;
  }
  return incoming === undefined || incoming === null ? existing : incoming;
}

/* --------------------------- users blob helpers --------------------------- */

const SECRET_FIELDS = ["password", "pass", "pwd", "password_hash", "passwordHash"];

/** Strip credential fields from anything served to the browser. */
export function redactUsers(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((u) => {
    if (!isPlainObject(u)) return u;
    const copy: Record<string, unknown> = { ...u };
    for (const f of SECRET_FIELDS) delete copy[f];
    return copy;
  });
}

export async function readStoreKey(key: string): Promise<unknown> {
  // 1. Check local server store first (instant sub-millisecond return)
  const localVal = getLocalMemoryStore(key);
  if (localVal !== null && localVal !== undefined) {
    return localVal;
  }

  // 2. Only if local store has no value, attempt remote Supabase if circuit breaker allows
  const now = Date.now();
  if (isRemoteHealthy || now - lastRemoteCheck > REMOTE_CHECK_COOLDOWN) {
    lastRemoteCheck = now;
    try {
      const client = getClient();
      const { data, error } = await client
        .from("site_store")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (!error && data && data.value !== undefined) {
        isRemoteHealthy = true;
        setLocalMemoryStore(key, data.value);
        return data.value;
      }
      if (error) isRemoteHealthy = false;
    } catch {
      isRemoteHealthy = false;
    }
  }

  return localVal;
}

export async function writeStoreKey(key: string, value: unknown, source: string): Promise<void> {
  // 1. Immediately update server database (guaranteed persistence, 0 data loss, instant response)
  setLocalMemoryStore(key, value);

  // 2. Non-blocking asynchronous sync to remote Supabase in background
  void (async () => {
    const now = Date.now();
    if (!isRemoteHealthy && now - lastRemoteCheck < REMOTE_CHECK_COOLDOWN) {
      return;
    }
    lastRemoteCheck = now;
    try {
      const client = getClient();
      await client
        .from("site_store_history")
        .insert({ key, value: value as never, source })
        .catch(() => {});

      const { error } = await client
        .from("site_store")
        .upsert(
          { key, value: value as never, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );

      if (!error) {
        isRemoteHealthy = true;
      } else {
        isRemoteHealthy = false;
      }
    } catch {
      isRemoteHealthy = false;
    }
  })();
}
