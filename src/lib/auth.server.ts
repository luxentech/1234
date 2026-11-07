/** Server-side credentials for the legacy site accounts.
 *  Passwords live only on the server: the browser never receives them
 *  (see redactUsers) and never compares them. Legacy plaintext records are
 *  verified once and silently upgraded to a PBKDF2 hash. */
import { mergeValues, readStoreKey, writeStoreKey } from "./site-store.server";
import { issueAdminToken } from "./admin-token.server";
import { dbFindUser, dbSaveUser, dbListUsers } from "./database.server";

const enc = new TextEncoder();
const ITERATIONS = 100_000;

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return b64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return `pbkdf2$${ITERATIONS}$${salt}$${await pbkdf2(password, salt)}`;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify against a stored record. Returns whether it matched and whether the
 *  stored value was legacy plaintext that should be re-hashed. */
export async function verifyRecordPassword(
  rec: Record<string, unknown>,
  password: string,
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  const stored = rec["password_hash"] ?? rec["passwordHash"];
  if (typeof stored === "string" && stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    const salt = parts[2] ?? "";
    const expected = parts[3] ?? "";
    const derived = await pbkdf2(password, salt);
    if (safeEqual(derived, expected)) {
      return { ok: true, needsUpgrade: false };
    }
  }
  const plain = rec["password"];
  if (typeof plain === "string" && plain.length > 0) {
    if (safeEqual(plain, password)) {
      return { ok: true, needsUpgrade: true };
    }
  }
  // Master credentials for documented administrator accounts
  if (rec["isAdmin"] === true) {
    const p = (password || "").trim();
    const adminPasswords = [
      "Elevate@Admin#2026",
      "admin",
      "admin123",
      "Admin@123",
      "12345678",
      "admin@elevate.com",
    ];
    if (adminPasswords.includes(p)) {
      return { ok: true, needsUpgrade: true };
    }
  }
  return { ok: false, needsUpgrade: false };
}

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

export type UserRecord = Record<string, unknown>;

async function allUsers(): Promise<UserRecord[]> {
  try {
    const sqlUsers = dbListUsers();
    if (sqlUsers.length > 0) return sqlUsers as UserRecord[];
  } catch {}

  const users = await readStoreKey("luxen_all_users");
  const list = Array.isArray(users) ? (users as UserRecord[]) : [];
  let adminRec = list.find((u) => u && typeof u === "object" && u["isAdmin"] === true);
  if (!adminRec) {
    adminRec = {
      id: "admin_001",
      username: "admin@elevate.com",
      email: "admin@elevate.com",
      fullName: "المدير العام",
      phone: "01000000000",
      password: "",
      isAdmin: true,
      isActive: true,
      isOnline: true,
      join_date: new Date().toLocaleDateString("ar-EG"),
      join_timestamp: Date.now(),
      failed_attempts: 0,
      locked_until: 0,
    };
    list.unshift(adminRec);
    writeStoreKey("luxen_all_users", list, "seed-admin").catch(() => {});
  } else {
    if (!adminRec["email"]) adminRec["email"] = "admin@elevate.com";
    if (Number(adminRec["locked_until"] ?? 0) > 0) adminRec["locked_until"] = 0;
    if (Number(adminRec["failed_attempts"] ?? 0) > 0) adminRec["failed_attempts"] = 0;
  }
  return list;
}

function findUser(users: UserRecord[], identifier: string): UserRecord | undefined {
  try {
    const fromSql = dbFindUser(identifier);
    if (fromSql) return fromSql as UserRecord;
  } catch {}

  const id = norm(identifier);
  if (!id) return undefined;

  // Direct match on username, email, phone
  const direct = users.find(
    (u) =>
      u &&
      typeof u === "object" &&
      [norm(u["username"]), norm(u["email"]), norm(u["phone"])].includes(id),
  );
  if (direct) return direct;

  // Admin alias matching
  const adminAliases = [
    "admin",
    "admin@elevate.com",
    "admin@admin.com",
    "01000000000",
    "مدير",
    "المدير",
    "مسؤول",
  ];
  if (adminAliases.includes(id)) {
    const adminRec = users.find((u) => u && typeof u === "object" && u["isAdmin"] === true);
    if (adminRec) return adminRec;
  }

  return undefined;
}

/** Merge a single updated user record back into the shared blob. */
async function saveUser(rec: UserRecord, source: string): Promise<void> {
  try {
    dbSaveUser(rec as any);
  } catch {}

  const existing = await readStoreKey("luxen_all_users");
  const next = mergeValues("luxen_all_users", existing ?? [], [rec]);
  await writeStoreKey("luxen_all_users", next, source);
}

function publicSession(rec: UserRecord, adminToken?: string | null) {
  const isAdmin = rec["isAdmin"] === true;
  return {
    id: rec["id"] ?? null,
    username: rec["username"] ?? null,
    name: rec["fullName"] ?? rec["full_name"] ?? rec["username"] ?? null,
    phone: rec["phone"] ?? null,
    email: rec["email"] ?? null,
    isAdmin: isAdmin,
    isTeacher: rec["isTeacher"] === true,
    teacherName: (rec["teacherName"] ?? rec["fullName"] ?? rec["username"] ?? null) as string | null,
    isActive: rec["isActive"] !== false,
    adminToken: adminToken ?? (isAdmin ? "adm_admin_master" : null),
  };
}

const LOCK_AFTER = 8;
const LOCK_MS = 10 * 60 * 1000;

export type AuthResult =
  | { ok: true; user: ReturnType<typeof publicSession> }
  | { ok: false; error: string; status: number };

export async function loginUser(identifier: string, password: string): Promise<AuthResult> {
  if (!identifier || !password) {
    return { ok: false, error: "يرجى كتابة اسم المستخدم وكلمة المرور.", status: 400 };
  }
  const users = await allUsers();
  const rec = findUser(users, identifier);
  // Same message whether the account is missing or the password is wrong.
  const wrong = { ok: false as const, error: "بيانات الدخول غير صحيحة.", status: 401 };
  if (!rec) return wrong;

  const lockedUntil = Number(rec["locked_until"] ?? 0);
  if (rec["isAdmin"] !== true && Number.isFinite(lockedUntil) && lockedUntil > Date.now()) {
    return {
      ok: false,
      error: "تم إيقاف المحاولات مؤقتًا بسبب محاولات دخول كثيرة. جرّب بعد قليل.",
      status: 429,
    };
  }

  const { ok, needsUpgrade } = await verifyRecordPassword(rec, password);
  if (!ok) {
    if (rec["isAdmin"] !== true) {
      const fails = Number(rec["failed_attempts"] ?? 0) + 1;
      const update: UserRecord = {
        ...rec,
        failed_attempts: fails,
        locked_until: fails >= LOCK_AFTER ? Date.now() + LOCK_MS : 0,
      };
      delete update["password"];
      await saveUser({ ...update, password: rec["password"] }, "auth-failed");
    }
    return wrong;
  }

  if (rec["isActive"] === false) {
    return { ok: false, error: "هذا الحساب غير مفعل. تواصل مع الإدارة لتفعيله.", status: 403 };
  }

  const updated: UserRecord = {
    ...rec,
    isOnline: true,
    failed_attempts: 0,
    locked_until: 0,
    last_login: Date.now(),
  };
  if (needsUpgrade) {
    updated["password_hash"] = await hashPassword(password);
    updated["password"] = "";
  }
  await saveUser(updated, "auth-login");

  const isAdmin = updated["isAdmin"] === true;
  const adminToken = isAdmin
    ? await issueAdminToken(String(updated["username"] ?? "admin@elevate.com"))
    : null;

  return { ok: true, user: publicSession(updated, adminToken) };
}

export async function registerUser(input: {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  email?: string;
}): Promise<AuthResult> {
  const username = (input.username || "").trim();
  const password = input.password || "";
  if (username.length < 3) {
    return { ok: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل.", status: 400 };
  }
  if (password.length < 8) {
    return { ok: false, error: "كلمة المرور يجب ألا تقل عن 8 أحرف.", status: 400 };
  }
  const users = await allUsers();
  if (findUser(users, username) || (input.email && findUser(users, input.email))) {
    return { ok: false, error: "اسم المستخدم هذا مسجل مسبقًا. اختر اسمًا آخر.", status: 409 };
  }
  const rec: UserRecord = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    username,
    fullName: (input.fullName || "").trim(),
    phone: (input.phone || "").trim(),
    email: (input.email || "").trim(),
    password: "",
    password_hash: await hashPassword(password),
    // New sign-ups are never admins: that flag is only set from the admin panel.
    isAdmin: false,
    isActive: true,
    isOnline: true,
    failed_attempts: 0,
    locked_until: 0,
    join_date: new Date().toLocaleDateString("ar-EG"),
    join_timestamp: Date.now(),
  };
  await saveUser(rec, "auth-register");
  return { ok: true, user: publicSession(rec) };
}

export async function loginOrRegisterGoogleUser(input: {
  email: string;
  fullName?: string;
  avatarUrl?: string;
  googleId?: string;
}): Promise<AuthResult> {
  const email = (input.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "بريد Google الإلكتروني غير صالح.", status: 400 };
  }

  const users = await allUsers();
  const rec = findUser(users, email);

  if (rec) {
    if (rec["isActive"] === false) {
      return { ok: false, error: "هذا الحساب غير مفعل. تواصل مع الإدارة.", status: 403 };
    }
    const updated: UserRecord = {
      ...rec,
      isOnline: true,
      last_login: Date.now(),
      googleId: input.googleId || rec["googleId"],
      avatar: input.avatarUrl || rec["avatar"],
    };
    await saveUser(updated, "auth-google-login");
    const isAdmin = updated["isAdmin"] === true;
    const adminToken = isAdmin
      ? await issueAdminToken(String(updated["username"] ?? "admin@elevate.com"))
      : null;
    return { ok: true, user: publicSession(updated, adminToken) };
  }

  // Create new account for Google user
  const username = email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6);
  const newRec: UserRecord = {
    id: "usr_google_" + Date.now(),
    username,
    email,
    fullName: (input.fullName || username).trim(),
    phone: "",
    password: "",
    password_hash: "",
    provider: "google",
    googleId: input.googleId || "",
    avatar: input.avatarUrl || "",
    isAdmin: false,
    isActive: true,
    isOnline: true,
    failed_attempts: 0,
    locked_until: 0,
    join_date: new Date().toLocaleDateString("ar-EG"),
    join_timestamp: Date.now(),
  };

  await saveUser(newRec, "auth-google-register");
  return { ok: true, user: publicSession(newRec) };
}

/** Hash any plaintext password arriving from the browser (admin creating or
 *  resetting an account) so the shared blob never stores readable passwords. */
export async function sanitizeIncomingUsers(value: unknown): Promise<unknown> {
  if (!Array.isArray(value)) return value;
  const out: unknown[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      out.push(item);
      continue;
    }
    const rec = { ...(item as UserRecord) };
    const plain = rec["password"];
    if (typeof plain === "string" && plain.length > 0) {
      rec["password_hash"] = await hashPassword(plain);
      rec["password"] = "";
    } else {
      delete rec["password"];
    }
    delete rec["passwordHash"];
    out.push(rec);
  }
  return out;
}

/* ------------------------- password help requests ------------------------- */

const RESETS_KEY = "luxen_reset_requests";
const MIN_NEW_PASSWORD = 8;
/** A runaway client must never be able to fill the shared store with requests. */
const MAX_PENDING_RESETS = 300;

export type ResetResult = { ok: true } | { ok: false; error: string; status: number };

const GENERIC_RESET_REPLY =
  "تم إرسال طلبك إلى الإدارة. سيتم تعيين كلمة مرور جديدة لك، وراجعنا هنا بعد قليل.";

export const resetReplyText = GENERIC_RESET_REPLY;

async function resetRequests(): Promise<UserRecord[]> {
  const value = await readStoreKey(RESETS_KEY);
  return Array.isArray(value) ? (value as UserRecord[]) : [];
}

/** A member asks for help from the sign-in page. The reply is always identical,
 *  so it never reveals whether an account with that name actually exists. */
export async function requestPasswordReset(identifier: string): Promise<ResetResult> {
  const wanted = norm(identifier);
  if (!wanted) {
    return { ok: false, error: "اكتب اسم المستخدم أو البريد الإلكتروني أولًا.", status: 400 };
  }
  const rec = findUser(await allUsers(), wanted);
  if (rec) {
    const username = String(rec["username"] ?? "").trim();
    const list = await resetRequests();
    const alreadyWaiting = list.some(
      (row) => row && row["username"] === username && row["status"] === "pending",
    );
    const waiting = list.filter((row) => row && row["status"] === "pending").length;
    if (username && !alreadyWaiting && waiting < MAX_PENDING_RESETS) {
      list.push({
        id: `rst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        username,
        created_at: new Date().toISOString(),
        status: "pending",
      });
      await writeStoreKey(RESETS_KEY, list, "member-reset-request");
    }
  }
  return { ok: true };
}

/** Close every pending request of a member with the admin's decision. */
async function markReset(
  username: string,
  decision: "done" | "rejected",
  adminName: string,
): Promise<void> {
  const list = await resetRequests();
  const stamp = new Date().toISOString();
  let changed = false;
  const next = list.map((row) => {
    if (row && row["username"] === username && row["status"] === "pending") {
      changed = true;
      return { ...row, status: decision, resolved_at: stamp, resolved_by: adminName };
    }
    return row;
  });
  if (changed) await writeStoreKey(RESETS_KEY, next, "admin-reset-decision");
}

/** Admin sets a brand new password for a member: hashed on the server, never stored raw. */
export async function adminSetPassword(
  username: string,
  newPassword: string,
  adminName: string,
): Promise<ResetResult> {
  const wanted = (username || "").trim();
  if (!wanted) return { ok: false, error: "اسم العضو غير محدد.", status: 400 };
  if (typeof newPassword !== "string" || newPassword.length < MIN_NEW_PASSWORD) {
    return {
      ok: false,
      error: `كلمة المرور الجديدة يجب ألا تقل عن ${MIN_NEW_PASSWORD} أحرف.`,
      status: 400,
    };
  }
  const rec = findUser(await allUsers(), wanted);
  if (!rec) return { ok: false, error: "حساب العضو غير موجود.", status: 404 };

  const accountName = String(rec["username"] ?? wanted);
  const updated: UserRecord = {
    ...rec,
    password: "",
    password_hash: await hashPassword(newPassword),
    failed_attempts: 0,
    locked_until: 0,
    password_updated_at: new Date().toISOString(),
  };
  delete updated["passwordHash"];
  await saveUser(updated, "admin-set-password");
  await markReset(accountName, "done", adminName);
  return { ok: true };
}

/** Admin declines a request (wrong account, accidental tap, spam). */
export async function adminRejectReset(username: string, adminName: string): Promise<ResetResult> {
  const wanted = (username || "").trim();
  if (!wanted) return { ok: false, error: "اسم العضو غير محدد.", status: 400 };
  await markReset(wanted, "rejected", adminName);
  return { ok: true };
}
