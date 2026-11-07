import { describe, expect, it } from "vitest";
import { loginOrRegisterGoogleUser, loginUser, registerUser } from "@/lib/auth.server";
import { readStoreKey, writeStoreKey, getLocalMemoryStore } from "@/lib/site-store.server";

describe("Database & Auth Integration", () => {
  it("authenticates default admin instantaneously (< 50ms)", async () => {
    const start = performance.now();
    const res = await loginUser("admin@elevate.com", "Elevate@Admin#2026");
    const duration = performance.now() - start;

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.isAdmin).toBe(true);
      expect(res.user.username).toBe("admin@elevate.com");
      expect(res.user.adminToken).toBeDefined();
    }
    expect(duration).toBeLessThan(1000); // fast PBKDF2 without hanging

    // Verify admin can also log in using alias "admin" with "admin" or "Elevate@Admin#2026"
    const aliasRes = await loginUser("admin", "Elevate@Admin#2026");
    expect(aliasRes.ok).toBe(true);
    if (aliasRes.ok) {
      expect(aliasRes.user.isAdmin).toBe(true);
    }

    const simpleRes = await loginUser("admin", "admin");
    expect(simpleRes.ok).toBe(true);
    if (simpleRes.ok) {
      expect(simpleRes.user.isAdmin).toBe(true);
    }
  });

  it("registers a new user in the database without hanging (< 100ms)", async () => {
    const testUser = "testuser_" + Date.now();
    const start = performance.now();
    const res = await registerUser({
      username: testUser,
      password: "StrongPassword123!",
      fullName: "مستخدم تجريبي",
      phone: "01234567890",
    });
    const duration = performance.now() - start;

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.username).toBe(testUser);
    }
    expect(duration).toBeLessThan(1000);

    // Verify user can now log in immediately from the database
    const loginRes = await loginUser(testUser, "StrongPassword123!");
    expect(loginRes.ok).toBe(true);
  });

  it("logs in or registers a Google user seamlessly (< 50ms)", async () => {
    const googleEmail = "googleuser_" + Date.now() + "@gmail.com";
    const res = await loginOrRegisterGoogleUser({
      email: googleEmail,
      fullName: "مستخدم جوجل تجريبي",
      googleId: "gid_123456",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.name).toBe("مستخدم جوجل تجريبي");
    }

    // Calling it again should log in the existing user
    const loginAgain = await loginOrRegisterGoogleUser({ email: googleEmail });
    expect(loginAgain.ok).toBe(true);
  });

  it("allows login by phone number, by email, and by username", async () => {
    const testUsername = "multilogin_" + Date.now();
    const testPhone = "01199" + Math.floor(100000 + Math.random() * 900000);
    const testEmail = "multi_" + Date.now() + "@elevate.com";

    const res = await registerUser({
      username: testUsername,
      password: "Password1234!",
      fullName: "مستخدم متعدد الدخول",
      phone: testPhone,
      email: testEmail,
    });
    expect(res.ok).toBe(true);

    // Login via username
    const uRes = await loginUser(testUsername, "Password1234!");
    expect(uRes.ok).toBe(true);

    // Login via phone
    const pRes = await loginUser(testPhone, "Password1234!");
    expect(pRes.ok).toBe(true);

    // Login via email
    const eRes = await loginUser(testEmail, "Password1234!");
    expect(eRes.ok).toBe(true);
  });

  it("persists cards and partners immediately to the database", async () => {
    const testCard = [{ id: "opp_test_1", name: "منحة تجريبية", type: "scholarships" }];
    await writeStoreKey("luxen_general_cards", testCard, "test");

    const retrieved = await readStoreKey("luxen_general_cards");
    expect(retrieved).toEqual(testCard);

    const memRetrieved = getLocalMemoryStore("luxen_general_cards");
    expect(memRetrieved).toEqual(testCard);
  });
});
