import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { createSign, generateKeyPairSync } from "node:crypto";
import { connect } from "../../src/db/connection.js";
import { configuration } from "../../src/config.js";
import { createSession, sessionMiddleware } from "../../src/security/sessions.js";
import { findFirebaseIdentity } from "../../src/repositories/firebase-identities.js";
import { registerFirebaseCustomer } from "../../src/modules/auth/firebase-registration.js";
import { changeFirebaseAdminSecurity, confirmFirebaseEmailChange, cancelFirebaseEmailChange, pendingFirebaseEmailChange } from "../../src/repositories/firebase-admin-security.js";

const projectId = "jm-test-project";
const firebaseUid = "synthetic-admin-uid";
const email = "admin@example.test";
const pendingEmail = "new-admin@example.test";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-admin", alg: "RS256", use: "sig" };
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function idToken({ uid = firebaseUid, emailAddress = email, expiresIn = 3600 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const first = b64({ alg: "RS256", typ: "JWT", kid: jwk.kid });
  const second = b64({ iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: uid, user_id: uid, iat: now - 2, auth_time: now - 3, exp: now + expiresIn, email: emailAddress, email_verified: true, firebase: { sign_in_provider: "password" } });
  const signer = createSign("RSA-SHA256"); signer.update(`${first}.${second}`);
  return `${first}.${second}.${signer.sign(privateKey).toString("base64url")}`;
}
const db = () => connect(env.DB);
const config = () => ({ ...configuration(env), firebase: { projectId, apiKey: "synthetic-public-web-api-key", sessionEncryptionKey: "cd".repeat(32) } });
const request = (user, body) => ({ db: db(), config: config(), user, body, requestId: "synthetic-request" });
let admin;
beforeEach(async () => {
  const date = new Date().toISOString();
  await db().run("INSERT OR IGNORE INTO roles(id,code) VALUES(1,'CUSTOMER'),(2,'ADMIN')");
  admin = await db().first("INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at,auth_provider,firebase_uid) VALUES((SELECT id FROM roles WHERE code='ADMIN'),?,'Admin sintético',?,?,?,'FIREBASE',?) RETURNING *", email, `firebase-managed:${firebaseUid}`, date, date, firebaseUid);
});
afterEach(() => vi.unstubAllGlobals());

function mockFirebase(extra = () => undefined) {
  const token = idToken();
  const calls = [];
  const fetcher = vi.fn(async (url) => {
    calls.push(String(url));
    if (String(url).includes("securetoken@system.gserviceaccount.com")) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "cache-control": "public, max-age=60" } });
    if (String(url).includes("accounts:signInWithPassword")) return new Response(JSON.stringify({ localId: firebaseUid, email, idToken: token, refreshToken: "synthetic-refresh", expiresIn: "3600" }), { status: 200 });
    if (String(url).includes("securetoken.googleapis.com")) return new Response(JSON.stringify({ user_id: firebaseUid, id_token: idToken(), refresh_token: "rotated-synthetic-refresh", expires_in: "3600" }), { status: 200 });
    const override = await extra(String(url));
    if (override !== undefined) return new Response(JSON.stringify(override), { status: 200 });
    if (String(url).includes("accounts:sendOobCode")) return new Response(JSON.stringify({ email: pendingEmail }), { status: 200 });
    if (String(url).includes("accounts:resetPassword")) return new Response(JSON.stringify({ requestType: "VERIFY_AND_CHANGE_EMAIL", email, newEmail: pendingEmail }), { status: 200 });
    if (String(url).includes("accounts:update")) return new Response(JSON.stringify({ localId: firebaseUid, email: pendingEmail }), { status: 200 });
    if (String(url).includes("accounts:lookup")) return new Response(JSON.stringify({ users: [{ localId: firebaseUid, email, emailVerified: true, disabled: false, validSince: "0" }] }), { status: 200 });
    const found = extra(String(url));
    return new Response(JSON.stringify(found ?? {}), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  return { calls, fetcher };
}
async function addSession() {
  const date = new Date().toISOString();
  await db().run("INSERT INTO sessions(token_hash,user_id,csrf_token,auth_version,namespace,created_at,last_seen_at,expires_at,auth_provider,firebase_uid,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext) VALUES('synthetic-session',?,'csrf',0,'staging',?,?,?,'FIREBASE',?,'iv.cipher','iv.cipher')", admin.id, date, date, new Date(Date.now() + 3600000).toISOString(), firebaseUid);
}

describe("Firebase administrator security", () => {
  it("blocks email changes on staging until the verified action handler is configured", async () => {
    const { fetcher } = mockFirebase();
    const req = request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version });
    req.config = { ...req.config, environment: "staging", emailActionReady: false };
    await expect(changeFirebaseAdminSecurity(req)).rejects.toMatchObject({ code: "EMAIL_ACTION_CONFIGURATION_REQUIRED" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db().first("SELECT COUNT(*) count FROM credential_operations")).toMatchObject({ count: 0 });
  });
  it("registers a CUSTOMER with an email claim and never links a pre-existing local account", async () => {
    const customerEmail = "new-customer@example.test", customerUid = "synthetic-customer-uid";
    const provider = {
      signUp: vi.fn(async () => ({ uid: customerUid, email: customerEmail, idToken: idToken({ uid: customerUid, emailAddress: customerEmail }), refreshToken: "customer-refresh-token" })),
      deleteAccount: vi.fn(),
    };
    let cookie;
    const req = { db: db(), config: config(), session: null, user: null, headers: {} };
    req.createSession = (id, verified) => createSession(req, { cookie: (_name, value) => { cookie = value; } }, id, verified);
    const user = await registerFirebaseCustomer(req, provider, { email: customerEmail, password: "synthetic-customer-password", name: "Cliente de prueba", phone: null });
    expect(user).toMatchObject({ email: customerEmail, role_id: 1, auth_provider: "FIREBASE", firebase_uid: customerUid });
    expect(req.user).toMatchObject({ id: user.id, role: "CUSTOMER" });
    expect(cookie).toBeTruthy();
    expect(await db().first("SELECT claim_kind,user_id,firebase_uid FROM email_claims WHERE email=?", customerEmail)).toMatchObject({ claim_kind: "ACCOUNT", user_id: user.id, firebase_uid: customerUid });
    expect(await findFirebaseIdentity(db(), customerUid, customerEmail)).toMatchObject({ id: user.id });

    const failedEmail = "signup-rollback@example.test", failedUid = "synthetic-orphan-uid";
    const failingProvider = {
      signUp: vi.fn(async () => ({ uid: failedUid, email: failedEmail, idToken: idToken({ uid: failedUid, emailAddress: failedEmail }), refreshToken: "orphan-refresh" })),
      deleteAccount: vi.fn(async () => undefined),
    };
    const failingReq = { db: db(), config: config(), createSession: async () => { throw new Error("synthetic D1 session failure"); } };
    await expect(registerFirebaseCustomer(failingReq, failingProvider, { email: failedEmail, password: "synthetic-customer-password", name: "Cliente", phone: null })).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(failingProvider.deleteAccount).toHaveBeenCalledOnce();
    expect(await db().first("SELECT id FROM users WHERE firebase_uid=?", failedUid)).toBeNull();
    expect(await db().first("SELECT email FROM email_claims WHERE email=?", failedEmail)).toBeNull();

    const localEmail = "legacy-local@example.test";
    await db().run("INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES(1,?,'Legacy','local-only',?,?)", localEmail, new Date().toISOString(), new Date().toISOString());
    const secondProvider = { signUp: vi.fn(), deleteAccount: vi.fn() };
    const duplicateReq = { db: db(), config: config() };
    await expect(registerFirebaseCustomer(duplicateReq, secondProvider, { email: localEmail, password: "synthetic-customer-password", name: "Cliente", phone: null })).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(secondProvider.signUp).not.toHaveBeenCalled();
    expect(await findFirebaseIdentity(db(), "unlinked-firebase-uid", localEmail)).toBeNull();
  });
  it("never links a Firebase login to an existing account by email alone", async () => {
    const legacyEmail = "legacy-local@example.test";
    await db().run("INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='CUSTOMER'),?,'Legacy local','scrypt-not-used',?,?)", legacyEmail, new Date().toISOString(), new Date().toISOString());
    expect(await findFirebaseIdentity(db(), "external-unlinked-uid", legacyEmail)).toBeNull();
    expect(await db().first("SELECT COUNT(*) count FROM users WHERE email=? AND auth_provider='LOCAL'", legacyEmail)).toMatchObject({ count: 1 });
    expect(await findFirebaseIdentity(db(), firebaseUid, "some-other-address@example.test")).toBeNull();
  });
  it("reserves registration atomically under duplicate requests and honors expiry during provider signup", async () => {
    const customerEmail = "concurrent-signup@example.test", customerUid = "concurrent-signup-uid";
    const provider = {
      signUp: vi.fn(async () => ({ uid: customerUid, idToken: idToken({ uid: customerUid, emailAddress: customerEmail }), refreshToken: "synthetic-refresh" })),
      deleteAccount: vi.fn(async () => undefined),
    };
    const makeReq = () => ({ db: db(), config: config(), createSession: async () => undefined });
    const body = { email: customerEmail, password: "synthetic-customer-password", name: "Cliente", phone: null };
    const outcomes = await Promise.allSettled([registerFirebaseCustomer(makeReq(), provider, body), registerFirebaseCustomer(makeReq(), provider, body)]);
    expect(outcomes.filter(item => item.status === "fulfilled")).toHaveLength(1);
    expect(provider.signUp).toHaveBeenCalledOnce();
    expect(await db().first("SELECT COUNT(*) count FROM users WHERE email=?", customerEmail)).toMatchObject({ count: 1 });

    const expiredEmail = "expired-signup@example.test", expiredUid = "expired-signup-uid";
    const expiredProvider = {
      signUp: vi.fn(async () => {
        await db().run("UPDATE email_claims SET expires_at=? WHERE email=?", new Date(Date.now() - 1000).toISOString(), expiredEmail);
        return { uid: expiredUid, idToken: idToken({ uid: expiredUid, emailAddress: expiredEmail }), refreshToken: "synthetic-refresh" };
      }),
      deleteAccount: vi.fn(async () => undefined),
    };
    await expect(registerFirebaseCustomer(makeReq(), expiredProvider, { ...body, email: expiredEmail })).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(expiredProvider.deleteAccount).toHaveBeenCalledOnce();
    expect(await db().first("SELECT id FROM users WHERE firebase_uid=?", expiredUid)).toBeNull();
    expect(await db().first("SELECT email FROM email_claims WHERE email=?", expiredEmail)).toBeNull();
  });
  it("stores only encrypted Firebase tokens in a revocable D1 session and validates them on requests", async () => {
    mockFirebase();
    const identityToken = idToken();
    let cookie;
    const req = { db: db(), config: config(), headers: {}, session: null, user: null };
    const res = { cookie: (_name, value) => { cookie = value; } };
    await createSession(req, res, admin.id, { provider: "FIREBASE", firebaseUid, idToken: identityToken, refreshToken: "synthetic-refresh-token", auth_version: admin.auth_version, password_hash: admin.password_hash });
    const stored = await db().first("SELECT * FROM sessions WHERE user_id=?", admin.id);
    expect(stored.firebase_id_token_ciphertext).not.toContain(identityToken);
    expect(stored.firebase_refresh_token_ciphertext).not.toContain("synthetic-refresh-token");
    const authenticated = { headers: { cookie: `jm-sdd.local.sid=${cookie}` }, db: db(), config: config() };
    await new Promise((resolve, reject) => sessionMiddleware(authenticated, {}, (error) => error ? reject(error) : resolve()));
    expect(authenticated.user).toMatchObject({ id: admin.id, role: "ADMIN", email });
  });

  it("coalesces concurrent Firebase token refreshes and persists the rotated encrypted token", async () => {
    const { calls } = mockFirebase(async (url) => {
      if (url.includes("securetoken.googleapis.com")) await new Promise(resolve => setTimeout(resolve, 20));
    });
    let cookie;
    const req = { db: db(), config: config(), headers: {}, session: null, user: null };
    await createSession(req, { cookie: (_name, value) => { cookie = value; } }, admin.id, { provider: "FIREBASE", firebaseUid, idToken: idToken({ expiresIn: -10 }), refreshToken: "expired-token-refresh", auth_version: admin.auth_version, password_hash: admin.password_hash });
    const makeRequest = () => ({ headers: { cookie: `jm-sdd.local.sid=${cookie}` }, db: db(), config: config() });
    const authenticate = async (request) => new Promise((resolve, reject) => sessionMiddleware(request, {}, error => error ? reject(error) : resolve()));
    const first = makeRequest(), second = makeRequest();
    await Promise.all([authenticate(first), authenticate(second)]);
    expect(first.user).toMatchObject({ id: admin.id, email });
    expect(second.user).toMatchObject({ id: admin.id, email });
    expect(calls.filter(url => url.includes("securetoken.googleapis.com"))).toHaveLength(1);
    const stored = await db().first("SELECT firebase_id_token_ciphertext,firebase_refresh_token_ciphertext FROM sessions WHERE user_id=?", admin.id);
    expect(stored.firebase_refresh_token_ciphertext).not.toContain("rotated-synthetic-refresh");
    expect(stored.firebase_id_token_ciphertext).not.toContain(idToken());
  });

  it("fails closed when Firebase reports a disabled account or a revoked token boundary", async () => {
    for (const account of [
      { localId: firebaseUid, email, emailVerified: true, disabled: true, validSince: "0" },
      { localId: firebaseUid, email, emailVerified: true, disabled: false, validSince: String(Math.floor(Date.now() / 1000)) },
    ]) {
      await db().run("DELETE FROM sessions");
      mockFirebase((url) => url.includes("accounts:lookup") ? { users: [account] } : undefined);
      let cookie;
      const req = { db: db(), config: config(), headers: {}, session: null, user: null };
      await createSession(req, { cookie: (_name, value) => { cookie = value; } }, admin.id, { provider: "FIREBASE", firebaseUid, idToken: idToken(), refreshToken: "synthetic-refresh-token", auth_version: admin.auth_version, password_hash: admin.password_hash });
      const authenticated = { headers: { cookie: `jm-sdd.local.sid=${cookie}` }, db: db(), config: config() };
      await new Promise((resolve, reject) => sessionMiddleware(authenticated, {}, (error) => error ? reject(error) : resolve()));
      expect(authenticated.user).toBeNull();
      expect(await db().first("SELECT COUNT(*) count FROM sessions WHERE user_id=?", admin.id)).toMatchObject({ count: 0 });
    }
  });

  it("rejects combined email/password changes before contacting Firebase", async () => {
    const { fetcher } = mockFirebase();
    await expect(changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, newPassword: "new-password-very-long", confirmNewPassword: "new-password-very-long", version: admin.version }))).rejects.toMatchObject({ code: "SEPARATE_CREDENTIAL_CHANGES" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reserves a pending email, keeps the existing address, and rejects a duplicate reservation", async () => {
    mockFirebase();
    const result = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    expect(result).toMatchObject({ pendingEmail, requiresVerification: true });
    expect(await db().first("SELECT email FROM users WHERE id=?", admin.id)).toMatchObject({ email });
    expect(await db().first("SELECT claim_kind,operation_id FROM email_claims WHERE email=?", pendingEmail)).toMatchObject({ claim_kind: "EMAIL_CHANGE", operation_id: result.operationId });
    expect(await pendingFirebaseEmailChange({ db: db(), user: admin })).toMatchObject({ operationId: result.operationId, pendingEmail, status: "PENDING" });
    await expect(changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }))).rejects.toMatchObject({ code: "EMAIL_CHANGE_PENDING" });
    const signupProvider = { signUp: vi.fn() };
    await expect(registerFirebaseCustomer({ db: db() }, signupProvider, { email: pendingEmail, password: "synthetic-customer-password", name: "Cliente", phone: null })).rejects.toMatchObject({ code: "REGISTRATION_UNAVAILABLE" });
    expect(signupProvider.signUp).not.toHaveBeenCalled();
  });

  it("rejects expired email actions without contacting Firebase", async () => {
    const { calls } = mockFirebase();
    const staged = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    await db().batch([
      db().stmt("UPDATE credential_operations SET expires_at=? WHERE id=?", new Date(Date.now() - 1).toISOString(), staged.operationId),
      db().stmt("UPDATE email_claims SET expires_at=? WHERE operation_id=?", new Date(Date.now() - 1).toISOString(), staged.operationId),
    ]);
    const providerCalls = calls.length;
    await expect(confirmFirebaseEmailChange(request(null, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }))).rejects.toMatchObject({ code: "EMAIL_CHANGE_EXPIRED" });
    expect(calls).toHaveLength(providerCalls);
    expect(await db().first("SELECT email FROM users WHERE id=?", admin.id)).toMatchObject({ email });
  });

  it("serializes competing customer registration and administrator email reservation", async () => {
    mockFirebase();
    const customerUid = "synthetic-racing-customer";
    const provider = { signUp: vi.fn(async () => ({ uid: customerUid, email: pendingEmail, idToken: idToken({ uid: customerUid, emailAddress: pendingEmail }), refreshToken: "synthetic-customer-refresh" })) };
    const registrationReq = { db: db(), createSession: async () => undefined };
    const outcomes = await Promise.allSettled([
      registerFirebaseCustomer(registrationReq, provider, { email: pendingEmail, password: "synthetic-customer-password", name: "Cliente", phone: null }),
      changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version })),
    ]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    const claim = await db().first("SELECT claim_kind,user_id,firebase_uid,operation_id FROM email_claims WHERE email=?", pendingEmail);
    expect(claim?.claim_kind === "ACCOUNT" || claim?.claim_kind === "EMAIL_CHANGE").toBe(true);
    if (claim.claim_kind === "ACCOUNT") expect(claim.firebase_uid).toBe(customerUid);
    else expect(claim.user_id).toBe(admin.id);
  });

  it("allows only one winner when email confirmation races with cancellation", async () => {
    let startedInspection, releaseInspection;
    const inspectionStarted = new Promise(resolve => { startedInspection = resolve; });
    const inspectionGate = new Promise(resolve => { releaseInspection = resolve; });
    const { calls } = mockFirebase(async url => {
      if (url.includes("accounts:resetPassword")) {
        startedInspection();
        await inspectionGate;
      }
    });
    const staged = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    const confirmation = confirmFirebaseEmailChange(request(null, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }));
    await inspectionStarted;
    const cancellation = await cancelFirebaseEmailChange(request(admin, { operationId: staged.operationId, currentPassword: "valid-current-password" }));
    expect(cancellation.cancelled).toBe(true);
    releaseInspection();
    await expect(confirmation).rejects.toMatchObject({ code: "EMAIL_CHANGE_CONFLICT" });
    expect(calls.some(url => url.includes("accounts:update"))).toBe(false);
    expect(await db().first("SELECT state FROM credential_operations WHERE id=?", staged.operationId)).toMatchObject({ state: "CANCELLED" });
    expect(await db().first("SELECT email,auth_version FROM users WHERE id=?", admin.id)).toMatchObject({ email, auth_version: 0 });
    expect(await db().first("SELECT COUNT(*) count FROM email_claims WHERE operation_id=?", staged.operationId)).toMatchObject({ count: 0 });
  });

  it("allows at most one concurrent pending email operation and supports cancellation", async () => {
    mockFirebase();
    const results = await Promise.allSettled([
      changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version })),
      changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version })),
    ]);
    const success = results.find((item) => item.status === "fulfilled");
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const cancelled = await cancelFirebaseEmailChange(request(admin, { operationId: success.value.operationId, currentPassword: "valid-current-password" }));
    expect(cancelled.cancelled).toBe(true);
    expect(await db().first("SELECT state FROM credential_operations WHERE id=?", success.value.operationId)).toMatchObject({ state: "CANCELLED" });
    expect(await db().first("SELECT COUNT(*) count FROM email_claims WHERE email=?", pendingEmail)).toMatchObject({ count: 0 });
  });

  it("reconciles an already-applied Firebase email change after the original D1 response was lost", async () => {
    const { calls } = mockFirebase((url) => url.includes("accounts:lookup") ? { users: [{ localId: firebaseUid, email: pendingEmail, emailVerified: true }] } : undefined);
    const staged = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    await db().batch([
      db().stmt("UPDATE credential_operations SET state='APPLYING' WHERE id=?", staged.operationId),
      db().stmt("UPDATE users SET auth_version=auth_version+1,version=version+1 WHERE id=?", admin.id),
      db().stmt("DELETE FROM sessions WHERE user_id=?", admin.id),
    ]);
    const result = await confirmFirebaseEmailChange(request(null, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }));
    expect(result).toMatchObject({ reconciled: true, email: pendingEmail });
    expect(calls.some((url) => url.includes("accounts:lookup"))).toBe(true);
    expect(calls.some((url) => url.includes("accounts:update"))).toBe(false);
    expect(await db().first("SELECT email FROM users WHERE id=?", admin.id)).toMatchObject({ email: pendingEmail });
    const operation = await db().first("SELECT state,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext FROM credential_operations WHERE id=?", staged.operationId);
    expect(operation).toMatchObject({ state: "COMPLETED", firebase_id_token_ciphertext: null, firebase_refresh_token_ciphertext: null });
    expect(JSON.stringify(await db().first("SELECT * FROM credential_operations WHERE id=?", staged.operationId))).not.toContain("synthetic-oob-code-value");
  });

  it("checks the OOB code first, revokes sessions before apply, then commits the verified email", async () => {
    const { calls } = mockFirebase(async (url) => {
      if (url.includes("accounts:update")) {
        expect(await db().first("SELECT COUNT(*) count FROM sessions WHERE user_id=?", admin.id)).toMatchObject({ count: 0 });
        expect(await db().first("SELECT email FROM users WHERE id=?", admin.id)).toMatchObject({ email });
        return { localId: firebaseUid, email: pendingEmail };
      }
    });
    const staged = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    await addSession();
    const confirmed = await confirmFirebaseEmailChange(request({ ...admin, firebase_uid: firebaseUid }, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }));
    expect(confirmed).toMatchObject({ requiresLogin: true, email: pendingEmail });
    const replay = await confirmFirebaseEmailChange(request(null, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }));
    expect(replay).toMatchObject({ requiresLogin: true, email: pendingEmail, reconciled: true });
    expect(calls.findIndex((url) => url.includes("accounts:resetPassword"))).toBeLessThan(calls.findIndex((url) => url.includes("accounts:update")));
    expect(calls.filter((url) => url.includes("accounts:update"))).toHaveLength(1);
    expect(await db().first("SELECT email,auth_version FROM users WHERE id=?", admin.id)).toMatchObject({ email: pendingEmail, auth_version: 1 });
    expect(await db().first("SELECT claim_kind,user_id,operation_id FROM email_claims WHERE email=?", pendingEmail)).toMatchObject({ claim_kind: "ACCOUNT", user_id: admin.id, operation_id: null });
    expect(await db().first("SELECT state FROM credential_operations WHERE id=?", staged.operationId)).toMatchObject({ state: "COMPLETED" });
    expect(await db().first("SELECT COUNT(*) count FROM sessions WHERE user_id=?", admin.id)).toMatchObject({ count: 0 });
  });

  it("does not apply an OOB code for another target address", async () => {
    mockFirebase((url) => url.includes("accounts:resetPassword") ? { requestType: "VERIFY_AND_CHANGE_EMAIL", email, newEmail: "someone-else@example.test" } : undefined);
    const staged = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", email: pendingEmail, version: admin.version }));
    await expect(confirmFirebaseEmailChange(request({ ...admin, firebase_uid: firebaseUid }, { operationId: staged.operationId, oobCode: "synthetic-oob-code-value" }))).rejects.toMatchObject({ code: "EMAIL_ACTION_MISMATCH" });
    expect(await db().first("SELECT state FROM credential_operations WHERE id=?", staged.operationId)).toMatchObject({ state: "PENDING" });
    expect(await db().first("SELECT email FROM users WHERE id=?", admin.id)).toMatchObject({ email });
  });

  it("revokes existing sessions before updating a password and persists no credential material", async () => {
    let sessionCountAtProvider;
    const { calls } = mockFirebase(async (url) => {
      if (url.includes("accounts:update")) {
        sessionCountAtProvider = (await db().first("SELECT COUNT(*) count FROM sessions WHERE user_id=?", admin.id)).count;
        return { localId: firebaseUid, email };
      }
    });
    await addSession();
    const result = await changeFirebaseAdminSecurity(request(admin, { currentPassword: "valid-current-password", newPassword: "new-password-very-long", confirmNewPassword: "new-password-very-long", version: admin.version }));
    expect(result.requiresLogin).toBe(true);
    expect(sessionCountAtProvider).toBe(0);
    expect(calls.some((url) => url.includes("accounts:update"))).toBe(true);
    expect(await db().first("SELECT COUNT(*) count FROM sessions WHERE user_id=?", admin.id)).toMatchObject({ count: 0 });
    const stored = JSON.stringify(await db().first("SELECT * FROM credential_operations WHERE user_id=?", admin.id));
    expect(stored).not.toContain("valid-current-password");
    expect(stored).not.toContain("new-password-very-long");
  });
});
