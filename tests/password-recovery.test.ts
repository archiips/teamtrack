// Explicit local database only; the mail transport is always mocked.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const browser = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: browser.token }) }),
}));
const enabled = /^postgres:\/\/tt@127\.0\.0\.1:54349\/teamtrack$/.test(
  process.env.DATABASE_URL || "",
);
describe.skipIf(!enabled)(
  "password recovery with isolated local database",
  () => {
    let accounts: typeof import("../src/lib/accounts");
    let recovery: typeof import("../src/lib/password-recovery");
    let store: typeof import("../src/lib/store");
    let userId: string;
    const email = `recovery-${Date.now()}@example.edu`;
    const deliveries: string[] = [];
    beforeAll(async () => {
      process.env.APP_URL = "http://localhost:3100";
      process.env.RESEND_API_KEY = "test-no-remote-delivery";
      process.env.EMAIL_FROM = "test@example.edu";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
          deliveries.push(JSON.parse(String(init.body)).text);
          return new Response(JSON.stringify({ id: "mock" }), { status: 200 });
        }),
      );
      accounts = await import("../src/lib/accounts");
      recovery = await import("../src/lib/password-recovery");
      store = await import("../src/lib/store");
      userId = await accounts.createAccount(
        "Recovery Tester",
        email,
        "original-password",
      );
    });
    afterAll(async () => {
      vi.unstubAllGlobals();
      if (store?.sql) {
        await store.sql`DELETE FROM teamtrack_password_reset WHERE user_id=${userId}`;
        await store.sql`DELETE FROM teamtrack_user WHERE id=${userId}`;
        await store.sql.end();
      }
    });
    it("sends only to own accounts and stores only hashes, without changing identity", async () => {
      await recovery.requestPasswordRecovery(
        `missing-${Date.now()}@example.edu`,
      );
      expect(deliveries).toHaveLength(0);
      await recovery.requestPasswordRecovery(email.toUpperCase());
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toContain(
        "http://localhost:3100/reset-password#token=",
      );
      const token = deliveries[0].match(/token=([a-f0-9]{64})/)![1];
      const [record] =
        await store.sql!`SELECT token_hash,user_id,expires_at FROM teamtrack_password_reset WHERE user_id=${userId}`;
      expect(record.token_hash).toBe(
        createHash("sha256").update(token).digest("hex"),
      );
      expect(record.token_hash).not.toBe(token);
      expect(record.user_id).toBe(userId);
      expect(
        new Date(record.expires_at).getTime() - Date.now(),
      ).toBeGreaterThan(29 * 60000);
      const oldVersion = await accounts.accountAuthVersion(userId);
      const auth = await import("../src/lib/auth");
      browser.token = (await auth.createSession(userId, "", true)).token;
      expect((await auth.session()).userId).toBe(userId);
      await recovery.resetPassword(token, "replacement-password");
      await expect(auth.session()).rejects.toThrow("sign in again");
      expect(await accounts.verifyLogin(email, "original-password")).toBeNull();
      expect(
        (await accounts.verifyLogin(email, "replacement-password"))?.userId,
      ).toBe(userId);
      expect(await accounts.accountAuthVersion(userId)).toBe(oldVersion! + 1);
      await expect(
        recovery.resetPassword(token, "third-password"),
      ).rejects.toThrow("invalid or expired");
    });
    it("rejects expired authentic tokens and consumes a valid token only once concurrently", async () => {
      await recovery.requestPasswordRecovery(email);
      const expired = deliveries.at(-1)!.match(/token=([a-f0-9]{64})/)![1];
      await store.sql!`UPDATE teamtrack_password_reset SET expires_at=now()-interval '1 second' WHERE user_id=${userId}`;
      await expect(
        recovery.resetPassword(expired, "never-installed"),
      ).rejects.toThrow("invalid or expired");
      await recovery.requestPasswordRecovery(email);
      const fresh = deliveries.at(-1)!.match(/token=([a-f0-9]{64})/)![1];
      const outcomes = await Promise.allSettled([
        recovery.resetPassword(fresh, "winner-password"),
        recovery.resetPassword(fresh, "winner-password"),
      ]);
      expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((x) => x.status === "rejected")).toHaveLength(1);
      expect(
        await store.sql!`SELECT * FROM teamtrack_password_reset WHERE user_id=${userId}`,
      ).toHaveLength(0);
    });
    it("shares email throttling in the database and reports missing setup", async () => {
      const before = deliveries.length;
      await Promise.all(
        Array.from({ length: 5 }, () =>
          recovery.requestPasswordRecovery(email),
        ),
      );
      expect(deliveries).toHaveLength(before);
      delete process.env.RESEND_API_KEY;
      await expect(recovery.requestPasswordRecovery(email)).rejects.toThrow(
        "not configured",
      );
    });
  },
);
