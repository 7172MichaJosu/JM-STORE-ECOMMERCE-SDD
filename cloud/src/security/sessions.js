import { randomBytes, createHash } from "node:crypto";
import { fail } from "../../../shared/domain/index.js";
import { decryptSessionToken, encryptSessionToken } from "./token-vault.js";
import { firebaseAuth } from "./firebase-auth.js";
import { verifyFirebaseIdToken } from "./firebase-id-token.js";
const digest = (v) => createHash("sha256").update(v).digest("hex");
let nextCleanup = 0;
const firebaseRefreshes = new Map();
export async function cleanupExpired(db) {
  const date = new Date().toISOString(),
    idle = new Date(Date.now() - 1800000).toISOString(),
    now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.stmt(
      "DELETE FROM sessions WHERE id IN(SELECT id FROM sessions WHERE expires_at<=? OR (user_id IS NOT NULL AND last_seen_at<?) LIMIT 20)",
      date,
      idle,
    ),
    db.stmt(
      "DELETE FROM rate_limit_buckets WHERE (bucket_key,window_start) IN(SELECT bucket_key,window_start FROM rate_limit_buckets WHERE expires_at<? LIMIT 100)",
      now,
    ),
  ]);
}
export const cookieName = (config) =>
  config.origin.startsWith("https://")
    ? "__Host-jm-sdd.sid"
    : "jm-sdd.local.sid";
export const cookieOptions = (config) => ({
  httpOnly: true,
  secure: config.origin.startsWith("https://"),
  sameSite: "lax",
  path: "/",
});
export const safeUser = async (db, id) =>
  db.first(
    "SELECT u.id,u.name,u.email,u.phone,u.is_active,u.version,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?",
    id,
  );
export async function sessionMiddleware(req, res, next) {
  const { db, config } = req;
  if (Date.now() >= nextCleanup) {
    nextCleanup = Date.now() + 60000;
    await cleanupExpired(db);
  }
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName(config) + "="))
    ?.slice(cookieName(config).length + 1);
  let s = raw
    ? await db.first(
        "SELECT * FROM sessions WHERE token_hash=? AND namespace=?",
        digest(raw),
        config.namespace,
      )
    : null;
  if (
    s &&
    (Date.parse(s.expires_at) <= Date.now() ||
      (s.user_id && Date.parse(s.last_seen_at) < Date.now() - 1800000))
  ) {
    await db.run("DELETE FROM sessions WHERE id=?", s.id);
    s = null;
  }
  req.user = null;
  req.authVersion = null;
  if (s?.user_id) {
    const u = await db.first(
      "SELECT u.*,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?",
      s.user_id,
    );
    if (!u?.is_active || s.auth_version !== u.auth_version ||
        (s.auth_provider === "FIREBASE" && (u.auth_provider !== "FIREBASE" || s.firebase_uid !== u.firebase_uid || !await validateFirebaseSession(s, db, config, u.email)))) {
      await db.run("DELETE FROM sessions WHERE id=?", s.id);
      s = null;
    } else {
      req.authVersion = u.auth_version;
      const {
        password_hash,
        auth_version,
        role_id,
        created_at,
        updated_at,
        ...safe
      } = u;
      req.user = safe;
    }
  }
  req.session = s;
  if (s)
    await db.run(
      "UPDATE sessions SET last_seen_at=? WHERE id=?",
      new Date().toISOString(),
      s.id,
    );
  req.createSession = (id = null, verified = null) =>
    createSession(req, res, id, verified);
  next();
}
export async function createSession(req, res, userId = null, verified = null) {
  const { db, config } = req,
    token = randomBytes(32).toString("base64url"),
    csrf = randomBytes(32).toString("base64url"),
    date = new Date().toISOString();
  const expiry = new Date(
      Date.now() + (userId ? 8 : 24) * 3600000,
    ).toISOString(),
    hash = digest(token),
    list = [];
  if (userId) {
    if (!verified) throw Error("Verified identity required.");
    const external = verified.provider === "FIREBASE";
    if (external && (!config.firebase || !verified.firebaseUid || !verified.idToken || !verified.refreshToken))
      throw Error("Verified Firebase identity required.");
    list.push(
      db.stmt(
        external
          ? "INSERT INTO mutation_contexts(operation_id,user_id,kind,created_at,ok) SELECT ?,?,'LOGIN',?,CASE WHEN EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1 AND auth_version=? AND password_hash=? AND auth_provider='FIREBASE' AND firebase_uid=?) THEN 1 ELSE 0 END"
          : "INSERT INTO mutation_contexts(operation_id,user_id,kind,created_at,ok) SELECT ?,?,'LOGIN',?,CASE WHEN EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1 AND auth_version=? AND password_hash=?) THEN 1 ELSE 0 END",
        hash,
        userId,
        date,
        userId,
        verified.auth_version,
        verified.password_hash,
        ...(external ? [verified.firebaseUid] : []),
      ),
    );
  }
  if (req.session)
    list.push(db.stmt("DELETE FROM sessions WHERE id=?", req.session.id));
  const sessionResultIndex = list.length;
  if (userId && verified.provider === "FIREBASE") {
    const idCipher = await encryptSessionToken(verified.idToken, config.firebase.sessionEncryptionKey);
    const refreshCipher = await encryptSessionToken(verified.refreshToken, config.firebase.sessionEncryptionKey);
    list.push(db.stmt(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,auth_version,namespace,created_at,last_seen_at,expires_at,auth_provider,firebase_uid,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext) VALUES(?,?,?,?,?,?,?,?, 'FIREBASE',?,?,?) RETURNING *",
      hash, userId, csrf, verified.auth_version, config.namespace, date, date, expiry,
      verified.firebaseUid, idCipher, refreshCipher,
    ));
  } else {
    list.push(db.stmt(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,auth_version,namespace,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?,?) RETURNING *",
      hash, userId, csrf, userId ? verified.auth_version : null, config.namespace, date, date, expiry,
    ));
  }
  if (userId)
    list.push(
      db.stmt("DELETE FROM mutation_contexts WHERE operation_id=?", hash),
    );
  if (userId) list.push(db.stmt("SELECT u.id,u.name,u.email,u.phone,u.is_active,u.version,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?", userId));
  const created = await db.batch(list);
  req.session = created[sessionResultIndex]?.results?.[0];
  if (!req.session) throw Error("Session creation failed.");
  req.authVersion = userId ? verified.auth_version : null;
  req.user = userId ? created.at(-1)?.results?.[0] : null;
  res.cookie(cookieName(config), token, {
    ...cookieOptions(config),
    ...(userId ? { maxAge: 8 * 3600000 } : {}),
  });
  return req.session;
}

async function validateFirebaseSession(session, db, config, expectedEmail) {
  if (!config.firebase || !session.firebase_id_token_ciphertext || !session.firebase_refresh_token_ciphertext) return false;
  try {
    let idToken = await decryptSessionToken(session.firebase_id_token_ciphertext, config.firebase.sessionEncryptionKey);
    let verified;
    try {
      verified = await verifyFirebaseIdToken(idToken, config.firebase.projectId);
      if (verified.expiresAt <= Math.floor(Date.now() / 1000) + 120) throw new Error("Token renewal required.");
    }
    catch {
      const refreshed = await refreshFirebaseSession(session, db, config);
      if (!refreshed) return false;
      ({ idToken, verified } = refreshed);
    }
    const account = await firebaseAuth(config.firebase).lookup(idToken);
    const revokedBefore = Number(account.validSince || 0);
    return verified.uid === session.firebase_uid && verified.email === expectedEmail &&
      account.uid === session.firebase_uid && account.email === expectedEmail &&
      !account.disabled && Number.isFinite(revokedBefore) && verified.authTime >= revokedBefore;
  } catch { return false; }
}

async function refreshFirebaseSession(session, db, config) {
  const key = `${config.identity}:${session.id}`;
  if (firebaseRefreshes.has(key)) {
    const shared = await firebaseRefreshes.get(key);
    if (!shared) return null;
    Object.assign(session, shared.sessionTokens);
    return shared;
  }
  const originalRefreshCiphertext = session.firebase_refresh_token_ciphertext;
  const job = (async () => {
    let refreshed;
    try {
      const refreshToken = await decryptSessionToken(originalRefreshCiphertext, config.firebase.sessionEncryptionKey);
      refreshed = await firebaseAuth(config.firebase).refresh(refreshToken);
      if (refreshed.uid !== session.firebase_uid) return null;
      const idCipher = await encryptSessionToken(refreshed.idToken, config.firebase.sessionEncryptionKey);
      const refreshCipher = await encryptSessionToken(refreshed.refreshToken, config.firebase.sessionEncryptionKey);
      const write = await db.run("UPDATE sessions SET firebase_id_token_ciphertext=?,firebase_refresh_token_ciphertext=? WHERE id=? AND firebase_refresh_token_ciphertext=?", idCipher, refreshCipher, session.id, originalRefreshCiphertext);
      if (!write?.meta?.changes) {
        const latest = await db.first("SELECT firebase_uid,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext FROM sessions WHERE id=?", session.id);
        if (!latest || latest.firebase_uid !== session.firebase_uid || latest.firebase_refresh_token_ciphertext === originalRefreshCiphertext) return null;
        const latestToken = await decryptSessionToken(latest.firebase_id_token_ciphertext, config.firebase.sessionEncryptionKey);
        const latestVerified = await verifyFirebaseIdToken(latestToken, config.firebase.projectId);
        if (latestVerified.uid !== session.firebase_uid) return null;
        return { idToken: latestToken, verified: latestVerified, sessionTokens: { firebase_id_token_ciphertext: latest.firebase_id_token_ciphertext, firebase_refresh_token_ciphertext: latest.firebase_refresh_token_ciphertext } };
      }
      const verified = await verifyFirebaseIdToken(refreshed.idToken, config.firebase.projectId);
      if (verified.uid !== session.firebase_uid) return null;
      return { idToken: refreshed.idToken, verified, sessionTokens: { firebase_id_token_ciphertext: idCipher, firebase_refresh_token_ciphertext: refreshCipher } };
    } catch {
      const latest = await db.first("SELECT firebase_uid,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext FROM sessions WHERE id=?", session.id).catch(() => null);
      if (!latest || latest.firebase_uid !== session.firebase_uid || latest.firebase_refresh_token_ciphertext === originalRefreshCiphertext) return null;
      try {
        const latestToken = await decryptSessionToken(latest.firebase_id_token_ciphertext, config.firebase.sessionEncryptionKey);
        const verified = await verifyFirebaseIdToken(latestToken, config.firebase.projectId);
        if (verified.uid !== session.firebase_uid) return null;
        return { idToken: latestToken, verified, sessionTokens: { firebase_id_token_ciphertext: latest.firebase_id_token_ciphertext, firebase_refresh_token_ciphertext: latest.firebase_refresh_token_ciphertext } };
      } catch { return null; }
    }
  })();
  firebaseRefreshes.set(key, job);
  try {
    const result = await job;
    if (result) Object.assign(session, result.sessionTokens);
    return result;
  } finally { firebaseRefreshes.delete(key); }
}
export function customerOnly(req, res, next) {
  if (!req.user) fail(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  if (req.user.role !== "CUSTOMER")
    fail(403, "FORBIDDEN", "Usa una cuenta de cliente.");
  next();
}
export function adminOnly(req, res, next) {
  if (!req.user) fail(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  if (req.user.role !== "ADMIN") fail(403, "FORBIDDEN", "Acceso no permitido.");
  next();
}
