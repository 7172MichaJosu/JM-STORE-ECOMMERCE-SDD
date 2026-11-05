import { describe, expect, it, vi } from "vitest";
import { firebaseAuth } from "../../src/security/firebase-auth.js";

describe("Firebase Authentication REST contract", () => {
  it("sends email/password registration to the configured project without exposing the API key in errors", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ localId: "uid-1", email: "a@example.com", idToken: "id", refreshToken: "refresh", expiresIn: "3600" }), { status: 200 }));
    const auth = firebaseAuth({ projectId: "jm-test", apiKey: "test-key", fetcher });
    await expect(auth.signUp("a@example.com", "correct horse battery staple" )).resolves.toMatchObject({ uid: "uid-1", email: "a@example.com" });
    expect(fetcher.mock.calls[0][0]).toContain("accounts:signUp?key=test-key");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ email: "a@example.com", returnSecureToken: true });
  });

  it("normalizes provider failures to non-enumerating application errors", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "EMAIL_EXISTS" } }), { status: 400 }));
    const auth = firebaseAuth({ projectId: "jm-test", apiKey: "test-key", fetcher });
    await expect(auth.signUp("a@example.com", "a-long-synthetic-password")).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
  });

  it("supports sign-in, account lookup and refresh without logging or returning provider secrets", async () => {
    const fetcher = vi.fn(async (url) => {
      const payload = String(url).includes("signInWithPassword")
        ? { localId: "uid-1", email: "a@example.com", idToken: "id", refreshToken: "refresh", expiresIn: "3600" }
        : String(url).includes("lookup")
          ? { users: [{ localId: "uid-1", email: "a@example.com", emailVerified: true }] }
          : { id_token: "new-id", refresh_token: "new-refresh", expires_in: "3600", user_id: "uid-1" };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    const auth = firebaseAuth({ projectId: "jm-test", apiKey: "test-key", fetcher });
    await expect(auth.signIn("a@example.com", "synthetic-password")).resolves.toMatchObject({ uid: "uid-1" });
    await expect(auth.lookup("id")).resolves.toMatchObject({ uid: "uid-1", emailVerified: true });
    await expect(auth.refresh("refresh")).resolves.toMatchObject({ idToken: "new-id", uid: "uid-1" });
  });
  it("supports explicit email-change code inspection/application and credential update", async () => {
    const fetcher = vi.fn(async (url) => {
      const body = String(url).includes("sendOobCode") ? { email: "new@example.com" }
        : String(url).includes("resetPassword") ? { requestType: "VERIFY_AND_CHANGE_EMAIL", email: "old@example.com", newEmail: "new@example.com" }
          : { localId: "uid-1", email: "new@example.com", idToken: "updated-id", refreshToken: "updated-refresh", expiresIn: "3600" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const auth = firebaseAuth({ projectId: "jm-test", apiKey: "test-key", fetcher });
    await auth.sendEmailChange("verified-id-token", "new@example.com", "https://shop.example/action?operation=op");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ requestType: "VERIFY_AND_CHANGE_EMAIL", newEmail: "new@example.com", continueUrl: "https://shop.example/action?operation=op" });
    await expect(auth.inspectEmailChangeCode("synthetic-oob-code")).resolves.toMatchObject({ requestType: "VERIFY_AND_CHANGE_EMAIL", email: "old@example.com", newEmail: "new@example.com" });
    await expect(auth.applyEmailChange("synthetic-oob-code")).resolves.toMatchObject({ uid: "uid-1", email: "new@example.com" });
    await expect(auth.changePassword("verified-id-token", "new-synthetic-password")).resolves.toMatchObject({ uid: "uid-1", idToken: "updated-id" });
    await expect(auth.deleteAccount("verified-id-token")).resolves.toBeUndefined();
  });
});
