import { randomUUID } from "node:crypto";
import { fields, integer, text, fail } from "../../../shared/domain/index.js";
import { firebaseAuth } from "../security/firebase-auth.js";
import { verifyFirebaseIdToken } from "../security/firebase-id-token.js";
import { decryptSessionToken, encryptSessionToken } from "../security/token-vault.js";

const PASSWORD = (value, field) => {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    fail(422, "VALIDATION", "Usa contraseñas de 12 a 128 caracteres.", { [field]: "Revisa la longitud." });
  return value;
};
const genericCredentials = () => fail(403, "CURRENT_PASSWORD_INVALID", "La contraseña actual no es correcta.", { currentPassword: "Verifica tu contraseña actual." });
const providerFor = (req) => firebaseAuth(req.config.firebase);

async function reauthenticate(req, password) {
  const provider = providerFor(req);
  let identity;
  try {
    identity = await provider.signIn(req.user.email, password);
    const token = await verifyFirebaseIdToken(identity.idToken, req.config.firebase.projectId);
    if (identity.uid !== req.user.firebase_uid || token.uid !== req.user.firebase_uid || token.email !== req.user.email) genericCredentials();
  } catch { genericCredentials(); }
  return identity;
}

export async function changeFirebaseAdminSecurity(req) {
  const { db, user } = req;
  const body = req.body ?? {};
  fields(body, ["currentPassword", "email", "newPassword", "confirmNewPassword", "version"]);
  integer(body.version, "version", 1);
  const currentPassword = PASSWORD(body.currentPassword, "currentPassword");
  const current = await db.first("SELECT * FROM users WHERE id=? AND auth_provider='FIREBASE'", user.id);
  if (!current?.is_active || current.firebase_uid !== user.firebase_uid) fail(401, "UNAUTHENTICATED", "Inicia sesión nuevamente.");
  if (body.version !== current.version) fail(409, "ACCOUNT_CHANGED", "Tu cuenta cambió. Recarga y revisa los datos.");
  const changingPassword = body.newPassword !== undefined;
  const changingEmailInput = body.email !== undefined && String(body.email).trim().length > 0;
  const changingEmail = changingEmailInput && String(body.email).trim().toLowerCase() !== current.email;
  let nextPassword;
  if (changingPassword && changingEmailInput) fail(422, "SEPARATE_CREDENTIAL_CHANGES", "Cambia el correo y la contrasena en operaciones separadas.");
  if (changingPassword) {
    nextPassword = PASSWORD(body.newPassword, "newPassword");
    if (body.confirmNewPassword !== nextPassword || nextPassword === currentPassword)
      fail(422, "VALIDATION", "La nueva contraseña debe ser diferente y coincidir con la confirmación.", { confirmNewPassword: "Revisa la confirmación." });
  } else if (body.confirmNewPassword !== undefined) fail(422, "VALIDATION", "Introduce la nueva contraseña.");
  const changingAnyEmail = body.email !== undefined && String(body.email).trim().length > 0;
  if (!changingPassword && !changingAnyEmail) fail(422, "VALIDATION", "Introduce un correo o contraseña diferente.");
  if (changingAnyEmail && req.config.environment !== "local" && !req.config.emailActionReady)
    fail(503, "EMAIL_ACTION_CONFIGURATION_REQUIRED", "El cambio de correo estará disponible cuando termine la configuración de verificación.");
  const identity = await reauthenticate(req, currentPassword);
  const now = new Date().toISOString();

  if (changingPassword) {
    if (await db.first("SELECT id FROM credential_operations WHERE user_id=? AND state IN('PENDING','APPLYING')", user.id))
      fail(409, "CREDENTIAL_CHANGE_PENDING", "Termina o cancela el cambio pendiente antes de cambiar la contrasena.");
    const operation = randomUUID();
    await db.batch([
      db.stmt("INSERT INTO credential_operations(id,user_id,kind,state,expires_at,created_at,updated_at) VALUES(?,?,'CHANGE_PASSWORD','APPLYING',?,?,?)", operation, user.id, new Date(Date.now() + 10 * 60_000).toISOString(), now, now),
      db.stmt("UPDATE users SET auth_version=auth_version+1,version=version+1,updated_at=? WHERE id=? AND auth_provider='FIREBASE' AND firebase_uid=? AND version=?", now, user.id, current.firebase_uid, current.version),
      db.stmt("DELETE FROM sessions WHERE user_id=?", user.id),
    ]);
    try {
      await providerFor(req).changePassword(identity.idToken, nextPassword);
    } catch {
      await db.run("UPDATE credential_operations SET state='FAILED',updated_at=? WHERE id=? AND state='APPLYING'", new Date().toISOString(), operation);
      fail(503, "CREDENTIAL_CHANGE_UNAVAILABLE", "No se pudo completar el cambio. Inicia sesión y verifica tus credenciales antes de volver a intentar.");
    }
    const completed = new Date().toISOString();
    await db.batch([
      db.stmt("UPDATE credential_operations SET state='COMPLETED',updated_at=? WHERE id=? AND state='APPLYING'", completed, operation),
      db.stmt("INSERT INTO security_events(id,user_id,event_type,changed_email,changed_password,request_id,created_at) VALUES(?,?,'ADMIN_CREDENTIALS_CHANGED',0,1,?,?)", operation, user.id, req.requestId, completed),
    ]);
    return { user: null, requiresLogin: true };
  }

  const email = text(body.email, "email", 3, 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[\x21-\x7e]+$/.test(email))
    fail(422, "VALIDATION", "Correo no válido.", { email: "Revisa el correo." });
  if (email === current.email) fail(422, "VALIDATION", "Introduce un correo diferente.");
  await db.run("UPDATE credential_operations SET state='FAILED',updated_at=? WHERE user_id=? AND state='PENDING' AND expires_at<=?", now, user.id, now);
  await db.run("DELETE FROM email_claims WHERE expires_at IS NOT NULL AND expires_at<=?", now);
  if (await db.first("SELECT id FROM credential_operations WHERE user_id=? AND state IN('PENDING','APPLYING')", user.id))
    fail(409, "EMAIL_CHANGE_PENDING", "Ya existe una solicitud de cambio de correo pendiente.");
  const operation = randomUUID();
  const expiry = new Date(Date.now() + 60 * 60_000).toISOString();
  const encryptedIdToken = await encryptSessionToken(identity.idToken, req.config.firebase.sessionEncryptionKey);
  const encryptedRefreshToken = await encryptSessionToken(identity.refreshToken, req.config.firebase.sessionEncryptionKey);
  let reserved;
  try { reserved = await db.batch([
    db.stmt("INSERT INTO credential_operations(id,user_id,kind,current_email,pending_email,firebase_uid,firebase_id_token_ciphertext,firebase_refresh_token_ciphertext,state,expires_at,created_at,updated_at) VALUES(?,?,'VERIFY_AND_CHANGE_EMAIL',?,?,?,?,?,'PENDING',?,?,?)", operation, user.id, current.email, email, current.firebase_uid, encryptedIdToken, encryptedRefreshToken, expiry, now, now),
    db.stmt("INSERT INTO email_claims(email,claim_kind,user_id,firebase_uid,operation_id,expires_at,created_at) SELECT ?,'EMAIL_CHANGE',?,?,?, ?,? WHERE NOT EXISTS(SELECT 1 FROM users WHERE email=?) AND NOT EXISTS(SELECT 1 FROM email_claims WHERE email=?)", email, user.id, current.firebase_uid, operation, expiry, now, email, email),
  ]); } catch {
    fail(409, "CREDENTIAL_CHANGE_PENDING", "Termina o cancela el cambio pendiente antes de iniciar otro.");
  }
  if (!reserved?.[1]?.meta?.changes) {
    await db.run("DELETE FROM credential_operations WHERE id=? AND state='PENDING'", operation);
    fail(409, "EMAIL_UNAVAILABLE", "No se puede usar ese correo.", { email: "Elige otro correo." });
  }
  try {
    await providerFor(req).sendEmailChange(identity.idToken, email, `${req.config.origin}/admin/mi-cuenta/seguridad/confirmar-correo?operation=${encodeURIComponent(operation)}`);
  } catch {
    await db.batch([
      db.stmt("DELETE FROM email_claims WHERE email=? AND operation_id=?", email, operation),
      db.stmt("UPDATE credential_operations SET state='FAILED',updated_at=? WHERE id=? AND state='PENDING'", new Date().toISOString(), operation),
    ]);
    fail(503, "EMAIL_CHANGE_UNAVAILABLE", "No se pudo enviar el enlace de verificación. Intenta más tarde.");
  }
  return { operationId: operation, pendingEmail: email, expiresAt: expiry, requiresVerification: true, message: "Revisa el nuevo correo y confirma el enlace para aplicar el cambio." };
}

export async function confirmFirebaseEmailChange(req) {
  const { db } = req;
  if (req.config.environment !== "local" && !req.config.emailActionReady)
    fail(503, "EMAIL_ACTION_CONFIGURATION_REQUIRED", "La verificación de correo aún no está disponible en este entorno.");
  fields(req.body, ["operationId", "oobCode"]);
  if (typeof req.body.operationId !== "string" || !/^[\da-f-]{36}$/i.test(req.body.operationId) || typeof req.body.oobCode !== "string" || req.body.oobCode.length < 10 || req.body.oobCode.length > 2048)
    fail(422, "VALIDATION", "Email action link is invalid.");
  const operation = await db.first("SELECT o.*,u.firebase_uid FROM credential_operations o JOIN users u ON u.id=o.user_id WHERE o.id=? AND o.kind='VERIFY_AND_CHANGE_EMAIL'", req.body.operationId);
  const now = new Date().toISOString();
  if (operation?.state === "COMPLETED") return { requiresLogin: true, email: operation.pending_email, reconciled: true };
  if (!operation || !["PENDING", "APPLYING"].includes(operation.state) || (operation.state === "PENDING" && operation.expires_at <= now))
    fail(409, "EMAIL_CHANGE_EXPIRED", "Email change request is no longer active.");
  const provider = providerFor(req);
  if (operation.state === "APPLYING" && await reconcileEmailChange(db, req, provider, operation))
    return { requiresLogin: true, email: operation.pending_email, reconciled: true };
  let code;
  try { code = await provider.inspectEmailChangeCode(req.body.oobCode); }
  catch { fail(422, "EMAIL_ACTION_INVALID", "Email action link is invalid or already used."); }
  if (code.requestType !== "VERIFY_AND_CHANGE_EMAIL" || code.newEmail !== operation.pending_email || (code.email && code.email !== operation.current_email))
    fail(422, "EMAIL_ACTION_MISMATCH", "Email action link does not match this request.");
  if (operation.state === "PENDING") {
    const applyToken = randomUUID();
    const transition = await db.batch([
      db.stmt("UPDATE credential_operations SET state='APPLYING',apply_token=?,updated_at=? WHERE id=? AND user_id=? AND state='PENDING' AND expires_at>? AND EXISTS(SELECT 1 FROM users WHERE id=? AND firebase_uid=? AND email=? AND is_active=1)", applyToken, now, operation.id, operation.user_id, now, operation.user_id, operation.firebase_uid, operation.current_email),
      db.stmt("UPDATE users SET auth_version=auth_version+1,version=version+1,updated_at=? WHERE id=? AND firebase_uid=? AND email=? AND is_active=1 AND EXISTS(SELECT 1 FROM credential_operations WHERE id=? AND state='APPLYING' AND apply_token=?)", now, operation.user_id, operation.firebase_uid, operation.current_email, operation.id, applyToken),
      db.stmt("DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM credential_operations WHERE id=? AND state='APPLYING' AND apply_token=?)", operation.user_id, operation.id, applyToken),
    ]);
    if (!transition?.[0]?.meta?.changes || !transition?.[1]?.meta?.changes)
      fail(409, "EMAIL_CHANGE_CONFLICT", "Account changed. Sign in and review the account.");
  }
  let updated;
  try {
    updated = await provider.applyEmailChange(req.body.oobCode);
    if (updated.uid !== operation.firebase_uid || updated.email !== operation.pending_email) throw new Error("Firebase identity mismatch.");
  } catch {
    fail(503, "EMAIL_ACTION_PENDING_RETRY", "The change is awaiting Firebase confirmation. Retry this action link.");
  }
  try { await finalizeEmailChange(db, req, operation); }
  catch { fail(503, "EMAIL_CHANGE_RECONCILIATION_REQUIRED", "The email was verified. Retry this action link to finish account reconciliation."); }
  return { requiresLogin: true, email: operation.pending_email };
}

async function reconcileEmailChange(db, req, provider, operation) {
  let userInfo;
  try {
    const token = await decryptSessionToken(operation.firebase_id_token_ciphertext, req.config.firebase.sessionEncryptionKey);
    userInfo = await provider.lookup(token);
  } catch {
    try {
      const refreshToken = await decryptSessionToken(operation.firebase_refresh_token_ciphertext, req.config.firebase.sessionEncryptionKey);
      const refreshed = await provider.refresh(refreshToken);
      userInfo = await provider.lookup(refreshed.idToken);
    } catch { return false; }
  }
  if (userInfo.uid !== operation.firebase_uid || userInfo.email !== operation.pending_email) return false;
  await finalizeEmailChange(db, req, operation);
  return true;
}

async function finalizeEmailChange(db, req, operation) {
  const completed = new Date().toISOString();
  const result = await db.batch([
    db.stmt("UPDATE users SET email=?,updated_at=? WHERE id=? AND firebase_uid=? AND email=? AND auth_provider='FIREBASE'", operation.pending_email, completed, operation.user_id, operation.firebase_uid, operation.current_email),
    db.stmt("UPDATE email_claims SET claim_kind='ACCOUNT',operation_id=NULL,expires_at=NULL WHERE email=? AND operation_id=? AND user_id=?", operation.pending_email, operation.id, operation.user_id),
    db.stmt("DELETE FROM email_claims WHERE email=? AND user_id=?", operation.current_email, operation.user_id),
    db.stmt("UPDATE credential_operations SET state='COMPLETED',firebase_id_token_ciphertext=NULL,firebase_refresh_token_ciphertext=NULL,updated_at=? WHERE id=? AND state='APPLYING'", completed, operation.id),
    db.stmt("INSERT INTO security_events(id,user_id,event_type,changed_email,changed_password,request_id,created_at) VALUES(?,?,'ADMIN_CREDENTIALS_CHANGED',1,0,?,?)", operation.id, operation.user_id, req.requestId || ("email-reconcile:" + operation.id), completed),
  ]);
  if (!result?.[0]?.meta?.changes || !result?.[3]?.meta?.changes) throw new Error("D1 reconciliation conflict.");
}

export async function pendingFirebaseEmailChange(req) {
  const row = await req.db.first("SELECT id,pending_email,state,expires_at FROM credential_operations WHERE user_id=? AND kind='VERIFY_AND_CHANGE_EMAIL' AND state IN('PENDING','APPLYING') AND expires_at>? ORDER BY created_at DESC LIMIT 1", req.user.id, new Date().toISOString());
  return row ? { operationId: row.id, pendingEmail: row.pending_email, status: row.state, expiresAt: row.expires_at } : null;
}

export async function cancelFirebaseEmailChange(req) {
  fields(req.body, ["operationId", "currentPassword"]);
  const operationId = req.body?.operationId;
  const currentPassword = PASSWORD(req.body?.currentPassword, "currentPassword");
  if (typeof operationId !== "string" || !/^[\da-f-]{36}$/i.test(operationId)) fail(422, "VALIDATION", "Solicitud de cambio no válida.");
  const current = await req.db.first("SELECT * FROM users WHERE id=? AND auth_provider='FIREBASE' AND is_active=1", req.user.id);
  if (!current || current.firebase_uid !== req.user.firebase_uid) fail(401, "UNAUTHENTICATED", "Inicia sesión nuevamente.");
  await reauthenticate(req, currentPassword);
  const now = new Date().toISOString();
  const result = await req.db.batch([
    req.db.stmt("UPDATE credential_operations SET state='CANCELLED',updated_at=? WHERE id=? AND user_id=? AND kind='VERIFY_AND_CHANGE_EMAIL' AND state='PENDING'", now, operationId, req.user.id),
    req.db.stmt("DELETE FROM email_claims WHERE operation_id=? AND EXISTS(SELECT 1 FROM credential_operations WHERE id=? AND state='CANCELLED')", operationId, operationId),
  ]);
  if (!result?.[0]?.meta?.changes) fail(409, "EMAIL_CHANGE_NOT_PENDING", "No hay una solicitud pendiente que se pueda cancelar.");
  return { cancelled: true, message: "La solicitud quedó cancelada. El enlace enviado ya no se aceptará en esta tienda." };
}
