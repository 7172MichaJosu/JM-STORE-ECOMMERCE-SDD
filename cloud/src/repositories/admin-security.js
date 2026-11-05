import { randomUUID } from "node:crypto";
import { fields, integer, text, fail } from "../../../shared/domain/index.js";
import { hashPassword, verifyPassword } from "../../../server/src/lib/passwords.js";

function password(value, field) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    fail(422, "VALIDATION", "Usa contraseñas de 12 a 128 caracteres.", { [field]: "Revisa la longitud." });
  return value;
}

export async function changeSecurity(req) {
  const { db, user, session, config } = req;
  const body = req.body ?? {};
  fields(body, ["currentPassword", "email", "newPassword", "confirmNewPassword", "version"]);
  integer(body.version, "version", 1);
  password(body.currentPassword, "currentPassword");
  let email;
  if (body.email !== undefined) {
    email = text(body.email, "email", 3, 254).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^[\x21-\x7e]+$/.test(email))
      fail(422, "VALIDATION", "Correo no válido.", { email: "Revisa el correo." });
  }
  const changingPassword = body.newPassword !== undefined;
  if (changingPassword) {
    password(body.newPassword, "newPassword");
    if (body.confirmNewPassword !== body.newPassword || body.newPassword === body.currentPassword)
      fail(422, "VALIDATION", "La nueva contraseña debe ser diferente y coincidir con la confirmación.", { confirmNewPassword: "Revisa la confirmación." });
  } else if (body.confirmNewPassword !== undefined)
    fail(422, "VALIDATION", "Introduce la nueva contraseña.");
  const current = await db.first("SELECT * FROM users WHERE id=?", user.id);
  if (!current || !current.is_active) fail(401, "UNAUTHENTICATED", "Inicia sesión nuevamente.");
  const changingEmail = email !== undefined && email !== current.email;
  if (!changingPassword && !changingEmail)
    fail(422, "VALIDATION", "Introduce un correo o contraseña diferente.");
  if (!(await verifyPassword(body.currentPassword, current.password_hash)))
    fail(403, "CURRENT_PASSWORD_INVALID", "La contraseña actual no es correcta.", { currentPassword: "Verifica tu contraseña actual." });
  if (body.version !== current.version)
    fail(409, "ACCOUNT_CHANGED", "Tu cuenta cambió. Recarga y revisa los datos.");
  if (changingEmail && await db.first("SELECT id FROM users WHERE email=? AND id<>?", email, user.id))
    fail(409, "EMAIL_UNAVAILABLE", "No se puede usar ese correo.", { email: "Elige otro correo." });
  const hash = changingPassword ? await hashPassword(body.newPassword) : current.password_hash;
  const operation = randomUUID(), date = new Date().toISOString();
  const idle = new Date(Date.now() - 1800000).toISOString();
  const statements = [
    db.stmt("INSERT INTO mutation_contexts(operation_id,user_id,kind,created_at,ok) SELECT ?,?,'ADMIN_SECURITY',?,CASE WHEN EXISTS(SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id JOIN sessions s ON s.user_id=u.id WHERE u.id=? AND r.code='ADMIN' AND u.is_active=1 AND u.version=? AND u.password_hash=? AND u.auth_version=? AND s.id=? AND s.namespace=? AND s.auth_version=u.auth_version AND s.expires_at>? AND s.last_seen_at>?) THEN 1 ELSE 0 END",
      operation, user.id, date, user.id, body.version, current.password_hash, current.auth_version,
      session.id, config.namespace, date, idle),
    db.stmt("UPDATE users SET email=?,password_hash=?,auth_version=auth_version+?,version=version+1,updated_at=? WHERE id=?", email ?? current.email, hash, Number(changingPassword), date, user.id),
    db.stmt("INSERT INTO security_events(id,user_id,event_type,changed_email,changed_password,request_id,created_at) VALUES(?,?,'ADMIN_CREDENTIALS_CHANGED',?,?,?,?)", operation, user.id, Number(changingEmail), Number(changingPassword), req.requestId, date),
  ];
  if (changingPassword) statements.push(db.stmt("DELETE FROM sessions WHERE user_id=?", user.id));
  statements.push(db.stmt("DELETE FROM mutation_contexts WHERE operation_id=?", operation));
  try { await db.batch(statements); }
  catch (error) {
    if (/MUTATION_CONFLICT/.test(error.message)) fail(409, "ACCOUNT_CHANGED", "Tu cuenta o sesión cambió. Inicia sesión o recarga los datos.");
    if (/UNIQUE constraint.*users.email/.test(error.message)) fail(409, "EMAIL_UNAVAILABLE", "No se puede usar ese correo.");
    fail(503, "STORAGE_UNAVAILABLE", "No se pudo guardar el cambio. Revisa tu cuenta antes de reintentar.");
  }
  return {
    user: changingPassword ? null : {
      id: current.id, name: current.name, email: email ?? current.email,
      phone: current.phone, is_active: current.is_active, version: current.version + 1, role: "ADMIN",
    },
    requiresLogin: changingPassword,
  };
}
