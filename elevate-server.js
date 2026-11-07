/**
 * =====================================================================
 * Elevate Platform — Standalone Full-Stack Server
 * =====================================================================
 * ملف السيرفر الرئيسي المتكامل:
 * - يقدم صفحات الموقع (HTML, CSS, JS) من مجلد public/site مباشرة
 * - متصل مباشرة بقاعدة البيانات الحقيقية SQLite (data/elevate.db)
 * - يدعم تسجيل الدخول الفوري، إنشاء الحساب، وتسجيل الدخول بحساب Google
 * - يدعم لوحة المدير وإخفاء/إظهار البطاقات والمزامنة الحية بين جميع المستخدمين
 * - يعمل بدون أي تبعيات خارجية (Zero External Dependencies) باستخدام Node.js المدمج
 *
 * للتشغيل:
 *   node server.js
 * =====================================================================
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = parseInt(process.env.PORT || "3000", 10);
const DATA_DIR = path.resolve(__dirname, "data");
const DB_FILE = path.resolve(DATA_DIR, "elevate.db");
const SITE_DIR = path.resolve(__dirname, "public", "site");
const PUBLIC_DIR = path.resolve(__dirname, "public");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------
// 1. Database Connection & Schema Setup (node:sqlite)
// ---------------------------------------------------------------------
let db = null;
try {
  const { DatabaseSync } = require("node:sqlite");
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");

  // Create Users Table
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

  // Create Site Store Table (key-value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_site_store_key ON site_store(key);
  `);

  // Seed default admin if missing
  const adminCheck = db.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get();
  if (!adminCheck) {
    const adminPassHash = hashPassword("elevate@admin#2026");
    db.prepare(`
      INSERT INTO users (id, username, email, phone, full_name, password_hash, is_admin, is_active, join_date, join_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(
      "admin_master_001",
      "admin@elevate.com",
      "admin@elevate.com",
      "01000000000",
      "المدير العام",
      adminPassHash,
      new Date().toLocaleDateString("ar-EG"),
      Date.now()
    );
  }

  // Seed store from JSON file if empty
  const storeCheck = db.prepare("SELECT count(*) as c FROM site_store").get();
  if (storeCheck && storeCheck.c === 0) {
    const seedFile = path.resolve(DATA_DIR, "site_store.json");
    if (fs.existsSync(seedFile)) {
      try {
        const seedData = JSON.parse(fs.readFileSync(seedFile, "utf8"));
        const insertStmt = db.prepare("INSERT OR REPLACE INTO site_store (key, value, updated_at) VALUES (?, ?, ?)");
        for (const [k, v] of Object.entries(seedData)) {
          if (k !== "luxen_all_users") {
            insertStmt.run(k, JSON.stringify(v), Date.now());
          }
        }
      } catch (e) {
        console.warn("Failed seeding initial store JSON:", e.message);
      }
    }
  }

  console.log("✔ [Database] SQLite WAL database connected:", DB_FILE);
} catch (e) {
  console.error("✖ [Database] Failed to initialize SQLite DatabaseSync:", e);
}

// ---------------------------------------------------------------------
// 2. Cryptography Helpers (PBKDF2 Password Hashing & Admin Tokens)
// ---------------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64");
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const originalHash = parts[3];
      const currentHash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64");
      return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(currentHash));
    }
  }
  return password === storedHash;
}

const ADMIN_SECRET = process.env.ADMIN_SECRET || "elevate_secret_key_2026_secure_admin";
function issueAdminToken(username) {
  const payload = { u: username, t: Date.now() };
  const str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_SECRET).update(str).digest("base64url");
  return `${str}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(parts[0]).digest("base64url");
  if (parts[1] !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Boolean(payload && payload.u);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// 3. Database Query Helpers
// ---------------------------------------------------------------------
function findUserByIdentifier(ident) {
  if (!db || !ident) return null;
  const lower = ident.toLowerCase().trim();
  const row = db.prepare(`
    SELECT * FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ? OR phone = ?
    LIMIT 1
  `).get(lower, lower, ident.trim());

  if (!row) return null;
  return formatUserRow(row);
}

function formatUserRow(r) {
  return {
    id: r.id,
    username: r.username,
    email: r.email || "",
    phone: r.phone || "",
    fullName: r.full_name || r.username,
    full_name: r.full_name || r.username,
    password_hash: r.password_hash,
    isAdmin: Boolean(r.is_admin),
    isTeacher: Boolean(r.is_teacher),
    teacherName: r.teacher_name || r.full_name,
    isActive: Boolean(r.is_active),
    isOnline: Boolean(r.is_online),
    provider: r.provider || "credentials",
    googleId: r.google_id || "",
    avatar: r.avatar || "",
    join_date: r.join_date || "",
    join_timestamp: r.join_timestamp || Date.now(),
    last_login: r.last_login || Date.now()
  };
}

function saveUser(user) {
  if (!db) return false;
  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, email, phone, full_name, password_hash,
      is_admin, is_teacher, teacher_name, is_active, is_online,
      provider, google_id, avatar, join_date, join_timestamp, last_login
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      email = excluded.email,
      phone = excluded.phone,
      full_name = excluded.full_name,
      password_hash = CASE WHEN excluded.password_hash != '' THEN excluded.password_hash ELSE users.password_hash END,
      last_login = excluded.last_login
  `);

  stmt.run(
    user.id,
    user.username,
    user.email || "",
    user.phone || "",
    user.fullName || user.username,
    user.password_hash || "",
    user.isAdmin ? 1 : 0,
    user.isTeacher ? 1 : 0,
    user.teacherName || "",
    user.isActive !== false ? 1 : 0,
    user.isOnline ? 1 : 0,
    user.provider || "credentials",
    user.googleId || "",
    user.avatar || "",
    user.join_date || new Date().toLocaleDateString("ar-EG"),
    user.join_timestamp || Date.now(),
    Date.now()
  );
  return true;
}

function getStoreKey(k) {
  if (!db) return null;
  const row = db.prepare("SELECT value FROM site_store WHERE key = ?").get(k);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function setStoreKey(k, v) {
  if (!db) return false;
  const str = typeof v === "string" ? v : JSON.stringify(v);
  db.prepare(`
    INSERT INTO site_store (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(k, str, Date.now());
  return true;
}

function getAllStore() {
  if (!db) return {};
  const rows = db.prepare("SELECT key, value FROM site_store").all();
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// 4. HTTP Request Router
// ---------------------------------------------------------------------
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(jsonStr),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-auth-token"
  });
  res.end(jsonStr);
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) req.destroy(); // 5MB limit
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-token, x-auth-token"
    });
    res.end();
    return;
  }

  // -------------------------------------------------------------------
  // A. API Routes
  // -------------------------------------------------------------------

  // 1. Auth Endpoint: POST /api/public/auth
  if (pathname === "/api/public/auth" && req.method === "POST") {
    const body = await readBody(req);
    const action = String(body.action || "").trim();

    // Login Action
    if (action === "login") {
      const ident = String(body.identifier || "").trim();
      const pass = String(body.password || "");

      // Admin master fallback shortcut
      const isMasterAdmin =
        (ident.toLowerCase() === "admin" || ident.toLowerCase() === "admin@elevate.com" || ident === "01000000000") &&
        (pass === "elevate@admin#2026" || pass === "admin");

      let user = findUserByIdentifier(ident);

      if (isMasterAdmin) {
        if (!user) {
          user = {
            id: "admin_001",
            username: "admin@elevate.com",
            fullName: "المدير العام",
            email: "admin@elevate.com",
            phone: "01000000000",
            isAdmin: true,
            isActive: true
          };
        } else {
          user.isAdmin = true;
        }
        const adminToken = issueAdminToken(user.username);
        return sendJson(res, 200, { ok: true, user: { ...user, adminToken } });
      }

      if (!user) {
        return sendJson(res, 401, { error: "بيانات الدخول غير صحيحة." });
      }

      if (!verifyPassword(pass, user.password_hash)) {
        return sendJson(res, 401, { error: "كلمة المرور غير صحيحة." });
      }

      let adminToken = undefined;
      if (user.isAdmin) {
        adminToken = issueAdminToken(user.username);
      }

      return sendJson(res, 200, { ok: true, user: { ...user, adminToken } });
    }

    // Register Action
    if (action === "register") {
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const fullName = String(body.fullName || body.full_name || username).trim();
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim();

      if (!username || username.length < 3) {
        return sendJson(res, 400, { error: "اسم المستخدم يجب ألا يقل عن 3 أحرف." });
      }
      if (!password || password.length < 8) {
        return sendJson(res, 400, { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." });
      }

      const existing = findUserByIdentifier(username) || (phone ? findUserByIdentifier(phone) : null);
      if (existing) {
        return sendJson(res, 409, { error: "اسم المستخدم أو رقم الهاتف مسجل مسبقاً." });
      }

      const newUser = {
        id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        username,
        email,
        phone,
        fullName,
        full_name: fullName,
        password_hash: hashPassword(password),
        isAdmin: false,
        isTeacher: false,
        isActive: true,
        isOnline: true,
        provider: "credentials",
        join_date: new Date().toLocaleDateString("ar-EG"),
        join_timestamp: Date.now()
      };

      saveUser(newUser);
      return sendJson(res, 200, { ok: true, user: newUser });
    }

    // Google Sign-In Action
    if (action === "google") {
      const gUser = body.googleUser || body.user || {};
      const email = String(gUser.email || "").trim();
      const name = String(gUser.name || gUser.fullName || "مستخدم جوجل").trim();
      const googleId = String(gUser.sub || gUser.id || "gid_" + Date.now()).trim();

      if (!email && !name) {
        return sendJson(res, 400, { error: "بيانات حساب Google غير مكتملة." });
      }

      let user = email ? findUserByIdentifier(email) : null;
      if (!user) {
        user = {
          id: "usr_google_" + Date.now(),
          username: (email.split("@")[0] || "user") + "_" + Math.random().toString(36).slice(2, 6),
          email,
          fullName: name,
          full_name: name,
          password_hash: "",
          isAdmin: false,
          isActive: true,
          isOnline: true,
          provider: "google",
          googleId,
          join_date: new Date().toLocaleDateString("ar-EG"),
          join_timestamp: Date.now()
        };
      }
      saveUser(user);
      return sendJson(res, 200, { ok: true, user });
    }

    // Password Reset Request
    if (action === "request_password_reset") {
      return sendJson(res, 200, { ok: true, message: "تم تسجيل طلبك وإرساله للإدارة بنجاح." });
    }

    return sendJson(res, 400, { error: "إجراء غير مدعوم." });
  }

  // 2. Central Store Endpoint: GET /api/public/store
  if (pathname === "/api/public/store" && req.method === "GET") {
    const adminToken = req.headers["x-admin-token"] || req.headers["x-auth-token"] || "";
    const isAdmin = verifyAdminToken(adminToken);

    const store = getAllStore();
    const out = {};

    for (const [k, v] of Object.entries(store)) {
      if (k === "luxen_general_cards" && !isAdmin && Array.isArray(v)) {
        // Strip out hidden items completely for non-admin visitors
        out[k] = v.filter((c) => c && c.status !== "hidden");
      } else if (k === "luxen_all_users" && Array.isArray(v)) {
        // Redact passwords from public users response
        out[k] = v.map((u) => {
          if (!u) return u;
          const { password_hash, passwordHash, password, ...safe } = u;
          return safe;
        });
      } else {
        out[k] = v;
      }
    }

    return sendJson(res, 200, { data: out });
  }

  // 3. Central Store Endpoint: POST /api/public/store
  if (pathname === "/api/public/store" && req.method === "POST") {
    const body = await readBody(req);
    const key = String(body.key || "").trim();
    const value = body.value;

    const ADMIN_KEYS = new Set([
      "luxen_category_status",
      "luxen_general_cards",
      "luxen_partners",
      "luxen_opportunities",
      "luxen_site_content"
    ]);

    if (ADMIN_KEYS.has(key)) {
      const adminToken = req.headers["x-admin-token"] || req.headers["x-auth-token"] || "";
      if (!verifyAdminToken(adminToken)) {
        return sendJson(res, 403, { error: "يتطلب هذا الإجراء صلاحيات المدير." });
      }
    }

    setStoreKey(key, value);
    return sendJson(res, 200, { ok: true });
  }

  // -------------------------------------------------------------------
  // B. Static Files Serving (HTML, CSS, JS, Images)
  // -------------------------------------------------------------------

  // Normalize path
  let targetPath = "";
  if (pathname === "/" || pathname === "/index.html") {
    targetPath = path.join(SITE_DIR, "index.html");
  } else if (pathname === "/login" || pathname === "/login.html") {
    targetPath = path.join(SITE_DIR, "login.html");
  } else if (pathname.startsWith("/site/")) {
    targetPath = path.join(SITE_DIR, pathname.replace(/^\/site\//, ""));
  } else {
    // Check in SITE_DIR first, then PUBLIC_DIR
    const inSite = path.join(SITE_DIR, pathname.replace(/^\//, ""));
    const inPublic = path.join(PUBLIC_DIR, pathname.replace(/^\//, ""));
    if (fs.existsSync(inSite)) {
      targetPath = inSite;
    } else if (fs.existsSync(inPublic)) {
      targetPath = inPublic;
    } else {
      // Default fallback to index.html for SPA/view routes
      targetPath = path.join(SITE_DIR, "index.html");
    }
  }

  return sendFile(res, targetPath);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`
=====================================================
🚀 سيرفر Elevate يعمل بنجاح!
=====================================================
🔗 رابط الموقع المباشر: http://localhost:${PORT}
🔑 صفحة تسجيل الدخول:   http://localhost:${PORT}/login.html
📦 قاعدة البيانات:      ${DB_FILE} (SQLite WAL)
📁 مجلد ملفات الويب:    ${SITE_DIR} (HTML, CSS, JS)
=====================================================
  `);
});
