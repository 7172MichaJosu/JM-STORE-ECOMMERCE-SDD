import { Router } from "express";
import { fields, text, fail } from "../../../../shared/domain/index.js";
import {
  hashPassword,
  verifyPassword,
} from "../../../../server/src/lib/passwords.js";
import { cookieName, cookieOptions } from "../../security/sessions.js";
import { limit } from "../../security/rate-limit.js";
import { firebaseAuth } from "../../security/firebase-auth.js";
import { verifyFirebaseIdToken } from "../../security/firebase-id-token.js";
import { findFirebaseIdentity } from "../../repositories/firebase-identities.js";
import { registerFirebaseCustomer } from "./firebase-registration.js";
export function credentials(body) {
  const email = text(body.email, "email", 3, 254).toLowerCase();
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    !/^[\x21-\x7e]+$/.test(email)
  )
    fail(422, "VALIDATION", "Correo no válido.");
  if (
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    fail(422, "VALIDATION", "Usa una contraseña de 12 a 128 caracteres.");
  return { email, password: body.password };
}
const response = (req) => ({
  user: req.user,
  capabilities: { adminSecurity: true, emailVerification: Boolean(req.config?.firebase), emailChangeReady: !req.config?.firebase || req.config.emailActionReady === true },
  csrfToken: req.session.csrf_token,
  expiry: req.session.expires_at,
  cartNotice:
    "Se restauró tu carrito guardado. El carrito de visitante no se fusiona.",
});
export function authRoutes(config = null) {
  if (config?.firebase) return firebaseAuthRoutes(config);
  if (config === null) {
    const local = authRoutes({});
    const external = firebaseAuthRoutes();
    return (req, res, next) => (req.config.firebase ? external : local)(req, res, next);
  }
  const r = Router();
  r.get("/session", async (req, res) => {
    if (!req.session) await req.createSession();
    res.json({ data: response(req) });
  });
  r.post("/register", limit("register", 5, 900, true), async (req, res) => {
    fields(req.body, ["name", "email", "password", "phone"]);
    const { email, password } = credentials(req.body),
      name = text(req.body.name, "name", 2, 100),
      phone = req.body.phone ? text(req.body.phone, "phone", 7, 20) : null;
    if (await req.db.first("SELECT id FROM users WHERE email=?", email))
      fail(
        409,
        "CONFLICT",
        "No se pudo registrar esta cuenta con los datos indicados.",
      );
    const hashed = await hashPassword(password),
      date = new Date().toISOString();
    const u = await req.db.first(
      "INSERT INTO users(role_id,email,name,phone,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='CUSTOMER'),?,?,?,?,?,?) RETURNING *",
      email,
      name,
      phone,
      hashed,
      date,
      date,
    );
    await req.createSession(u.id, u);
    res.status(201).json({ data: response(req) });
  });
  r.post("/login", limit("login", 10, 900, true), async (req, res) => {
    fields(req.body, ["email", "password"]);
    const { email, password } = credentials(req.body);
    const u = await req.db.first("SELECT * FROM users WHERE email=?", email),
      valid = await verifyPassword(password, u?.password_hash);
    if (!valid || !u?.is_active)
      fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    await req.createSession(u.id, u);
    res.json({ data: response(req) });
  });
  r.post("/logout", async (req, res) => {
    if (req.session)
      await req.db.run("DELETE FROM sessions WHERE id=?", req.session.id);
    res.clearCookie(cookieName(req.config), cookieOptions(req.config));
    res.status(204).end();
  });
  return r;
}

function firebaseAuthRoutes(config) {
  const r = Router();
  r.get("/session", async (req, res) => {
    if (!req.session) await req.createSession();
    res.json({ data: response(req) });
  });
  r.post("/register", limit("register", 5, 900, true), async (req, res) => {
    const provider = firebaseAuth((config || req.config).firebase);
    fields(req.body, ["name", "email", "password", "phone"]);
    const { email, password } = credentials(req.body);
    const name = text(req.body.name, "name", 2, 100);
    const phone = req.body.phone ? text(req.body.phone, "phone", 7, 20) : null;
    await registerFirebaseCustomer(req, provider, { email, password, name, phone });
    res.status(201).json({ data: response(req) });
  });
  r.post("/login", limit("login", 10, 900, true), async (req, res) => {
    const currentConfig = config || req.config;
    const provider = firebaseAuth(currentConfig.firebase);
    fields(req.body, ["email", "password"]);
    const { email, password } = credentials(req.body);
    let identity;
    let verified;
    try {
      identity = await provider.signIn(email, password);
      verified = await verifyFirebaseIdToken(identity.idToken, currentConfig.firebase.projectId);
      if (verified.uid !== identity.uid || verified.email !== email) throw new Error("Identity mismatch.");
    } catch {
      fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    }
    const user = await findFirebaseIdentity(req.db, verified.uid, email);
    if (!user) fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
    await req.createSession(user.id, {
      provider: "FIREBASE", firebaseUid: verified.uid, idToken: identity.idToken, refreshToken: identity.refreshToken,
      auth_version: user.auth_version, password_hash: user.password_hash,
    });
    res.json({ data: response(req) });
  });
  r.post("/logout", async (req, res) => {
    if (req.session) await req.db.run("DELETE FROM sessions WHERE id=?", req.session.id);
    res.clearCookie(cookieName(req.config), cookieOptions(req.config));
    res.status(204).end();
  });
  return r;
}
