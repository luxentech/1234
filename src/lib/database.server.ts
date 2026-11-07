/** Real Server SQL Database Engine
 *  Uses SQLite (node:sqlite DatabaseSync) with real relational SQL tables,
 *  indices, transactions, and ACID durability.
 *  Zero browser-only storage: all users, cards, partners, and site state
 *  live exclusively on the server database. */

import fs from "node:fs";
import path from "node:path";

export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  fullName?: string;
  full_name?: string;
  password?: string;
  password_hash?: string;
  passwordHash?: string;
  isAdmin?: boolean;
  isTeacher?: boolean;
  teacherName?: string;
  isActive?: boolean;
  isOnline?: boolean;
  provider?: string;
  googleId?: string;
  avatar?: string;
  failed_attempts?: number;
  locked_until?: number;
  join_date?: string;
  join_timestamp?: number;
  last_login?: number;
  [key: string]: unknown;
}

const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

const BASE_DATA_DIR = path.resolve(process.cwd(), "data");
const BASE_DB_FILE = path.resolve(BASE_DATA_DIR, "elevate.db");
const SEED_JSON_FILE = path.resolve(BASE_DATA_DIR, "site_store.json");

const DB_DIR = IS_SERVERLESS ? "/tmp" : BASE_DATA_DIR;
const DB_FILE = path.resolve(DB_DIR, "elevate.db");

let sqlDb: any = null;
let isInitialized = false;

// Dynamic loader for node:sqlite to support all runtime variants safely
function getSqliteModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node:sqlite");
  } catch {
    try {
      // @ts-ignore
      return import.meta.require ? import.meta.require("node:sqlite") : null;
    } catch {
      return null;
    }
  }
}

export function getDatabase() {
  if (sqlDb) return sqlDb;

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (IS_SERVERLESS && !fs.existsSync(DB_FILE) && fs.existsSync(BASE_DB_FILE)) {
      try {
        fs.copyFileSync(BASE_DB_FILE, DB_FILE);
      } catch {}
    }

    const sqlite = getSqliteModule();
    if (sqlite && sqlite.DatabaseSync) {
      sqlDb = new sqlite.DatabaseSync(DB_FILE);
      initTables(sqlDb);
      return sqlDb;
    }
  } catch (err) {
    console.warn("[Elevate Database] Falling back to memory database:", err);
  }

  // Memory fallback if disk write failed
  try {
    const sqlite = getSqliteModule();
    if (sqlite && sqlite.DatabaseSync) {
      sqlDb = new sqlite.DatabaseSync(":memory:");
      initTables(sqlDb);
      return sqlDb;
    }
  } catch {}

  return null;
}

function initTables(db: any) {
  if (isInitialized) return;
  isInitialized = true;

  // 1. Enable WAL mode for high concurrency & speed
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
  } catch {}

  // 2. Relational Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      phone TEXT,
      full_name TEXT,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_teacher INTEGER NOT NULL DEFAULT 0,
      teacher_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_online INTEGER NOT NULL DEFAULT 0,
      provider TEXT,
      google_id TEXT,
      avatar TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      join_date TEXT,
      join_timestamp INTEGER,
      last_login INTEGER,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);

  // 3. Central Application Store Table (ACID key-value with timestamps)
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_site_store_updated ON site_store(updated_at DESC);
  `);

  // 4. Opportunities / Cards Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_opps_category ON opportunities(category);
    CREATE INDEX IF NOT EXISTS idx_opps_status ON opportunities(status);
  `);

  // 5. Partners Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // 6. Seed / Migrate initial data if database is fresh
  migrateFromSeedFile(db);
}

function migrateFromSeedFile(db: any) {
  try {
    const countRow = db.prepare("SELECT COUNT(*) AS count FROM site_store").get();
    if (countRow && countRow.count > 0) return; // already populated

    const seedFile = fs.existsSync(SEED_JSON_FILE)
      ? SEED_JSON_FILE
      : fs.existsSync(path.resolve(process.cwd(), "site_store.json"))
        ? path.resolve(process.cwd(), "site_store.json")
        : null;

    if (!seedFile) return;

    const raw = fs.readFileSync(seedFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const insertStore = db.prepare(`
      INSERT OR REPLACE INTO site_store (key, value, updated_at, source)
      VALUES (?, ?, ?, ?)
    `);

    for (const [k, v] of Object.entries(parsed)) {
      insertStore.run(k, JSON.stringify(v), Date.now(), "migration");
    }

    // Sync users into users table
    if (Array.isArray(parsed["luxen_all_users"])) {
      for (const u of parsed["luxen_all_users"]) {
        if (!u || !u.username) continue;
        dbSaveUser(u, db);
      }
    }

    // Ensure default admin exists
    ensureDefaultAdmin(db);
    console.log("[Elevate Database] Successfully migrated to real SQLite database.");
  } catch (err) {
    console.warn("[Elevate Database] Migration note:", err);
  }
}

function ensureDefaultAdmin(db: any) {
  try {
    const adminExists = db
      .prepare(
        "SELECT id FROM users WHERE is_admin = 1 OR username = 'admin@elevate.com' LIMIT 1",
      )
      .get();

    if (!adminExists) {
      const defaultAdmin: UserRecord = {
        id: "admin_001",
        username: "admin@elevate.com",
        email: "admin@elevate.com",
        fullName: "المدير العام",
        phone: "01000000000",
        password_hash:
          "pbkdf2$100000$uhnDzeH2keGwfS0sf4rqPw==$oGiOe4hxAWkmY3jJgYJmuiirxyGY0JUfc3ACM/qEdds=",
        isAdmin: true,
        isActive: true,
        isOnline: true,
        join_date: new Date().toLocaleDateString("ar-EG"),
        join_timestamp: Date.now(),
        failed_attempts: 0,
        locked_until: 0,
      };
      dbSaveUser(defaultAdmin, db);
    }
  } catch {}
}

/* ----------------- User Table Operations ----------------- */

export function dbSaveUser(u: UserRecord, customDb?: any): void {
  const db = customDb || getDatabase();
  if (!db) return;

  const id = String(u.id || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const username = String(u.username || "").trim();
  if (!username) return;

  const email = (u.email || "").trim().toLowerCase();
  const phone = (u.phone || "").trim();
  const fullName = u.fullName || u.full_name || username;
  const passwordHash = u.password_hash || u.passwordHash || "";
  const isAdmin = u.isAdmin === true ? 1 : 0;
  const isTeacher = u.isTeacher === true ? 1 : 0;
  const teacherName = u.teacherName || "";
  const isActive = u.isActive !== false ? 1 : 0;
  const isOnline = u.isOnline === true ? 1 : 0;
  const provider = u.provider || "credentials";
  const googleId = u.googleId || "";
  const avatar = u.avatar || "";
  const failedAttempts = Number(u.failed_attempts || 0);
  const lockedUntil = Number(u.locked_until || 0);
  const joinDate = u.join_date || new Date().toLocaleDateString("ar-EG");
  const joinTimestamp = Number(u.join_timestamp || Date.now());
  const lastLogin = Number(u.last_login || Date.now());

  // Store any extra non-standard fields in metadata JSON
  const standardKeys = new Set([
    "id",
    "username",
    "email",
    "phone",
    "fullName",
    "full_name",
    "password",
    "password_hash",
    "passwordHash",
    "isAdmin",
    "isTeacher",
    "teacherName",
    "isActive",
    "isOnline",
    "provider",
    "googleId",
    "avatar",
    "failed_attempts",
    "locked_until",
    "join_date",
    "join_timestamp",
    "last_login",
  ]);

  const metadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(u)) {
    if (!standardKeys.has(k)) metadata[k] = v;
  }

  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, email, phone, full_name, password_hash,
      is_admin, is_teacher, teacher_name, is_active, is_online,
      provider, google_id, avatar, failed_attempts, locked_until,
      join_date, join_timestamp, last_login, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      email = excluded.email,
      phone = excluded.phone,
      full_name = excluded.full_name,
      password_hash = CASE WHEN excluded.password_hash != '' THEN excluded.password_hash ELSE users.password_hash END,
      is_admin = excluded.is_admin,
      is_teacher = excluded.is_teacher,
      teacher_name = excluded.teacher_name,
      is_active = excluded.is_active,
      is_online = excluded.is_online,
      provider = excluded.provider,
      google_id = excluded.google_id,
      avatar = excluded.avatar,
      failed_attempts = excluded.failed_attempts,
      locked_until = excluded.locked_until,
      last_login = excluded.last_login,
      metadata = excluded.metadata
  `);

  stmt.run(
    id,
    username,
    email,
    phone,
    fullName,
    passwordHash,
    isAdmin,
    isTeacher,
    teacherName,
    isActive,
    isOnline,
    provider,
    googleId,
    avatar,
    failedAttempts,
    lockedUntil,
    joinDate,
    joinTimestamp,
    lastLogin,
    JSON.stringify(metadata),
  );

  // Keep luxen_all_users in site_store synchronized automatically
  syncUsersToStore(db);
}

function rowToUser(row: any): UserRecord {
  if (!row) return null as any;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(row.metadata || "{}");
  } catch {}

  return {
    ...meta,
    id: row.id,
    username: row.username,
    email: row.email || "",
    phone: row.phone || "",
    fullName: row.full_name || row.username,
    full_name: row.full_name || row.username,
    password_hash: row.password_hash || "",
    passwordHash: row.password_hash || "",
    isAdmin: Boolean(row.is_admin),
    isTeacher: Boolean(row.is_teacher),
    teacherName: row.teacher_name || row.full_name || row.username,
    isActive: Boolean(row.is_active),
    isOnline: Boolean(row.is_online),
    provider: row.provider || "credentials",
    googleId: row.google_id || "",
    avatar: row.avatar || "",
    failed_attempts: row.failed_attempts || 0,
    locked_until: row.locked_until || 0,
    join_date: row.join_date || "",
    join_timestamp: row.join_timestamp || 0,
    last_login: row.last_login || 0,
  };
}

export function dbFindUser(identifier: string): UserRecord | null {
  const db = getDatabase();
  if (!db) return null;

  const id = (identifier || "").trim().toLowerCase();
  if (!id) return null;

  // Direct match on username, email, phone
  const row = db
    .prepare(
      `SELECT * FROM users
       WHERE LOWER(username) = ? OR LOWER(email) = ? OR phone = ?
       LIMIT 1`,
    )
    .get(id, id, identifier.trim());

  if (row) return rowToUser(row);

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
    const adminRow = db
      .prepare("SELECT * FROM users WHERE is_admin = 1 ORDER BY last_login DESC LIMIT 1")
      .get();
    if (adminRow) return rowToUser(adminRow);
  }

  return null;
}

export function dbListUsers(): UserRecord[] {
  const db = getDatabase();
  if (!db) return [];

  try {
    const rows = db.prepare("SELECT * FROM users ORDER BY join_timestamp ASC").all();
    return rows.map(rowToUser);
  } catch {
    return [];
  }
}

function syncUsersToStore(db: any) {
  try {
    const all = db.prepare("SELECT * FROM users ORDER BY join_timestamp ASC").all();
    const mapped = all.map(rowToUser);
    db.prepare(`
      INSERT INTO site_store (key, value, updated_at, source)
      VALUES ('luxen_all_users', ?, ?, 'db-users-sync')
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(mapped), Date.now());
  } catch {}
}

/* ----------------- Store Table Operations ----------------- */

export function dbReadStoreKey(key: string): unknown {
  const db = getDatabase();
  if (!db) return null;

  try {
    const row = db.prepare("SELECT value FROM site_store WHERE key = ?").get(key);
    if (!row || !row.value) return null;
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function dbWriteStoreKey(key: string, value: unknown, source = "api"): void {
  const db = getDatabase();
  if (!db) return;

  const raw = JSON.stringify(value);
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO site_store (key, value, updated_at, source)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at,
        source = excluded.source
    `).run(key, raw, now, source);

    // If key is luxen_all_users, also ensure the users table is kept in sync
    if (key === "luxen_all_users" && Array.isArray(value)) {
      for (const u of value) {
        if (u && typeof u === "object" && u.username) {
          try {
            dbSaveUser(u, db);
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error("[Elevate Database] Write error for key:", key, err);
  }
}

export function dbGetAllStore(): Record<string, unknown> {
  const db = getDatabase();
  if (!db) return {};

  try {
    const rows = db.prepare("SELECT key, value FROM site_store").all();
    const result: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        result[r.key] = JSON.parse(r.value);
      } catch {
        result[r.key] = r.value;
      }
    }
    return result;
  } catch {
    return {};
  }
}
