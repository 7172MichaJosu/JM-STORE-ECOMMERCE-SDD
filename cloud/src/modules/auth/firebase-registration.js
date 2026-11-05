import { randomUUID } from "node:crypto";
import { fail } from "../../../../shared/domain/index.js";

export async function registerFirebaseCustomer(req, provider, { email, password, name, phone }) {
  const { db } = req;
  const operation = randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  try {
    const reserved = await db.batch([
      db.stmt("DELETE FROM email_claims WHERE email=? AND expires_at IS NOT NULL AND expires_at<=?", email, now),
      db.stmt("INSERT INTO email_claims(email,claim_kind,operation_id,expires_at,created_at) SELECT ?,'REGISTRATION',?,?,? WHERE NOT EXISTS(SELECT 1 FROM users WHERE email=?)", email, operation, expiresAt, now, email),
    ]);
    if (!reserved[1]?.meta?.changes) throw new Error("Email unavailable.");
  } catch {
    fail(409, "REGISTRATION_UNAVAILABLE", "No se pudo registrar esta cuenta con los datos indicados.");
  }
  let identity;
  try {
    identity = await provider.signUp(email, password);
    const marker = `firebase-managed:${identity.uid}`;
    const checkedAt = new Date().toISOString();
    const created = await db.batch([
      db.stmt("INSERT INTO users(role_id,email,name,phone,password_hash,created_at,updated_at,auth_provider,firebase_uid) SELECT (SELECT id FROM roles WHERE code='CUSTOMER'),?,?,?,?,?,?,'FIREBASE',? WHERE EXISTS(SELECT 1 FROM email_claims WHERE email=? AND operation_id=? AND expires_at>?) RETURNING *", email, name, phone, marker, now, now, identity.uid, email, operation, checkedAt),
      db.stmt("UPDATE email_claims SET claim_kind='ACCOUNT',user_id=(SELECT id FROM users WHERE firebase_uid=?),firebase_uid=?,operation_id=NULL,expires_at=NULL WHERE email=? AND operation_id=? AND expires_at>? RETURNING user_id,claim_kind", identity.uid, identity.uid, email, operation, checkedAt),
    ]);
    const user = created[0]?.results?.[0];
    const claim = created[1]?.results?.[0];
    if (!user || claim?.user_id !== user.id || claim.claim_kind !== "ACCOUNT") throw new Error("Firebase identity reservation failed.");
    await req.createSession(user.id, {
      provider: "FIREBASE", firebaseUid: identity.uid, idToken: identity.idToken, refreshToken: identity.refreshToken,
      auth_version: user.auth_version, password_hash: user.password_hash,
    });
    return user;
  } catch {
    if (identity?.idToken) await provider.deleteAccount(identity.idToken).catch(() => {});
    if (identity?.uid) {
      await db.run("DELETE FROM sessions WHERE user_id IN(SELECT id FROM users WHERE firebase_uid=?)", identity.uid).catch(() => {});
      await db.run("DELETE FROM email_claims WHERE firebase_uid=? AND claim_kind='ACCOUNT'", identity.uid).catch(() => {});
      await db.run("DELETE FROM users WHERE firebase_uid=? AND auth_provider='FIREBASE'", identity.uid).catch(() => {});
    }
    await db.run("DELETE FROM email_claims WHERE email=? AND operation_id=?", email, operation).catch(() => {});
    fail(409, "REGISTRATION_UNAVAILABLE", "No se pudo registrar esta cuenta con los datos indicados.");
  }
}
