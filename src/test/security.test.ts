import { describe, expect, it } from "vitest";
import { sanitizePayload, sanitizeString } from "@/lib/sanitize.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { ADMIN_ONLY_KEYS, ALLOWED_KEY_SET } from "@/lib/site-store.server";

describe("Security Sanitization", () => {
  it("strips malicious script tags from strings", () => {
    const malicious = '<script>alert("hacked")</script>فرصة مميزة للطلاب';
    const clean = sanitizeString(malicious);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("فرصة مميزة للطلاب");
  });

  it("strips inline event handlers", () => {
    const malicious = '<img src="x" onerror="alert(1)">منحة دراسية';
    const clean = sanitizeString(malicious);
    expect(clean).not.toContain("onerror=");
    expect(clean).toContain("منحة دراسية");
  });

  it("strips javascript: pseudoprotocol", () => {
    const malicious = '<a href="javascript:doEvil()">اضغط هنا</a>';
    const clean = sanitizeString(malicious);
    expect(clean).not.toContain("javascript:");
  });

  it("recursively sanitizes nested objects and arrays", () => {
    const input = {
      title: "فرصة <script>evil()</script>",
      nested: {
        comments: [{ text: "مرحبا <img src=x onerror=evil()>", author: "علي" }],
      },
    };
    const sanitized = sanitizePayload(input);
    expect(sanitized.title).toBe("فرصة ");
    expect(sanitized.nested.comments[0].text).toBe("مرحبا <img src=x >");
    expect(sanitized.nested.comments[0].author).toBe("علي");
  });
});

describe("Rate Limiting", () => {
  it("allows requests within threshold and blocks when limit is exceeded", () => {
    const ip = "192.168.1." + Math.floor(Math.random() * 1000);
    const opts = { windowMs: 1000, maxRequests: 3, keyPrefix: "test" };

    const r1 = checkRateLimit(ip, opts);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(ip, opts);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(ip, opts);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = checkRateLimit(ip, opts);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});

describe("Protected Admin Keys", () => {
  it("contains critical site configuration and content keys", () => {
    expect(ADMIN_ONLY_KEYS.has("luxen_general_cards")).toBe(true);
    expect(ADMIN_ONLY_KEYS.has("luxen_partners")).toBe(true);
    expect(ADMIN_ONLY_KEYS.has("luxen_settings")).toBe(true);
    expect(ADMIN_ONLY_KEYS.has("luxen_faq")).toBe(true);
    expect(ADMIN_ONLY_KEYS.has("luxen_category_status")).toBe(true);
  });

  it("all admin keys are within ALLOWED_KEY_SET", () => {
    for (const key of ADMIN_ONLY_KEYS) {
      expect(ALLOWED_KEY_SET.has(key)).toBe(true);
    }
  });
});
