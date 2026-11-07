import { createFileRoute } from "@tanstack/react-router";
import { hasConfig, json } from "@/lib/site-store.server";
import {
  adminRejectReset,
  adminSetPassword,
  loginOrRegisterGoogleUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetReplyText,
} from "@/lib/auth.server";
import { adminTokenSubject, issueAdminToken, verifyAdminToken } from "@/lib/admin-token.server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit.server";
import { sanitizeString } from "@/lib/sanitize.server";

function decodeGoogleToken(credential: string): { email?: string; name?: string; picture?: string; sub?: string } {
  try {
    const parts = credential.split(".");
    if (parts.length >= 2) {
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const payload = JSON.parse(jsonStr);
      return {
        email: payload.email,
        name: payload.name || payload.given_name,
        picture: payload.picture,
        sub: payload.sub,
      };
    }
  } catch {}
  return {};
}

export const Route = createFileRoute("/api/public/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasConfig()) return json({ error: "Server configuration missing" }, 500);

        const ip = getClientIp(request);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const str = (k: string) =>
          typeof body[k] === "string" ? sanitizeString(body[k] as string).trim() : "";
        const rawPassword = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
        const action = str("action");

        if (action === "login") {
          const rate = checkRateLimit(ip, {
            windowMs: 60 * 1000,
            maxRequests: 500,
            keyPrefix: "auth-login",
          });
          if (!rate.allowed) {
            return json(
              { error: "محاولات كثيرة جداً لتسجيل الدخول. يرجى الانتظار قليلاً والمحاولة مجدداً." },
              429,
            );
          }

          try {
            const res = await loginUser(str("identifier"), rawPassword("password"));
            if (res.ok && res.user) {
              let adminToken: string | undefined = undefined;
              if (res.user.isAdmin) {
                adminToken = await issueAdminToken(res.user.username || "admin");
              }
              return json({ ok: true, user: { ...res.user, adminToken } });
            }
            return json({ error: res.error }, res.status);
          } catch (err) {
            return json({ error: "بيانات الدخول غير صحيحة." }, 401);
          }
        }

        if (action === "register") {
          const rate = checkRateLimit(ip, {
            windowMs: 60 * 1000,
            maxRequests: 300,
            keyPrefix: "auth-register",
          });
          if (!rate.allowed) {
            return json({ error: "محاولات كثيرة جداً للتسجيل. يرجى الانتظار قليلاً." }, 429);
          }

          try {
            const res = await registerUser({
              username: str("username"),
              password: rawPassword("password"),
              fullName: str("fullName"),
              phone: str("phone"),
              email: str("email"),
            });
            return res.ok
              ? json({ ok: true, user: res.user })
              : json({ error: res.error }, res.status);
          } catch (err) {
            return json({ error: "تعذّر تسجيل الحساب، يرجى مراجعة البيانات والمحاولة مجدداً." }, 400);
          }
        }

        if (action === "google_login") {
          const rate = checkRateLimit(ip, {
            windowMs: 60 * 1000,
            maxRequests: 300,
            keyPrefix: "auth-google",
          });
          if (!rate.allowed) {
            return json({ error: "محاولات كثيرة جداً، يرجى الانتظار قليلاً." }, 429);
          }

          let email = str("email");
          let fullName = str("fullName");
          let avatarUrl = str("avatarUrl");
          let googleId = str("googleId");

          const credential = typeof body["credential"] === "string" ? body["credential"] : "";
          if (credential) {
            const decoded = decodeGoogleToken(credential);
            if (decoded.email) email = decoded.email;
            if (decoded.name) fullName = decoded.name;
            if (decoded.picture) avatarUrl = decoded.picture;
            if (decoded.sub) googleId = decoded.sub;
          }

          if (!email) {
            return json({ error: "لم يتم استلام البريد الإلكتروني لحساب Google." }, 400);
          }

          try {
            const res = await loginOrRegisterGoogleUser({
              email,
              fullName,
              avatarUrl,
              googleId,
            });
            return res.ok
              ? json({ ok: true, user: res.user })
              : json({ error: res.error }, res.status);
          } catch (err) {
            return json({ error: "تعذّر تسجيل الدخول بحساب Google، يرجى المحاولة لاحقاً." }, 500);
          }
        }

        // A member asks the team for a new password. Identical reply in every case.
        if (action === "request_password_reset") {
          const rate = checkRateLimit(ip, {
            windowMs: 5 * 60 * 1000,
            maxRequests: 4,
            keyPrefix: "auth-reset",
          });
          if (!rate.allowed) {
            return json(
              { error: "تم إرسال طلب مؤخراً. يرجى الانتظار قبل المحاولة مرة أخرى." },
              429,
            );
          }

          const res = await requestPasswordReset(str("identifier"));
          return res.ok
            ? json({ ok: true, message: resetReplyText })
            : json({ error: res.error }, res.status);
        }

        // Setting or declining a password is admin-only: the token was signed by us.
        if (action === "admin_reset_password" || action === "admin_reject_password_reset") {
          const token = (body["token"] as string) || "";
          if (!(await verifyAdminToken(token))) {
            return json({ error: "هذه العملية متاحة للإدارة فقط." }, 401);
          }
          const admin = adminTokenSubject(token) || "admin";
          const res =
            action === "admin_reset_password"
              ? await adminSetPassword(str("username"), rawPassword("password"), admin)
              : await adminRejectReset(str("username"), admin);
          return res.ok ? json({ ok: true }) : json({ error: res.error }, res.status);
        }

        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
