import { Router } from "express";
import { fields, text } from "../../lib/validation.js";
import { fail } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/passwords.js";
import { loginLimit, registrationLimit } from "../../middleware/rate-limit.js";
function credentials(body) {
  const email = text(body.email, "email", 3, 254).toLowerCase();
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    !/^[\x21-\x7e]+$/.test(email)
  )
    fail(422, "VALIDATION", "Correo no válido.", {
      email: "Ingresa un correo válido.",
    });
  if (
    typeof body.password !== "string" ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    fail(422, "VALIDATION", "Revisa tu contraseña.", {
      password: "Usa de 12 a 128 caracteres.",
    });
  return { email, password: body.password };
}
const data = (req) => ({
  user: req.user,
  csrfToken: req.session.csrf_token,
  expiry: req.session.expires_at,
  cartNotice:
    "Se restauró tu carrito guardado. El carrito de visitante no se fusiona.",
});
export function authRoutes(db, config) {
  const r = Router();
  r.get("/session", (req, res) => {
    if (!req.session) req.createSession();
    res.json({ data: data(req) });
  });
  r.post(
    "/register",
    config.testing ? (q, s, n) => n() : registrationLimit(),
    async (req, res) => {
      fields(req.body, ["name", "email", "password", "phone"]);
      const { email, password } = credentials(req.body);
      const name = text(req.body.name, "name", 2, 100);
      const phone = req.body.phone
        ? text(req.body.phone, "phone", 7, 20)
        : null;
      if (db.prepare("SELECT 1 FROM users WHERE email=?").get(email))
        fail(
          409,
          "CONFLICT",
          "No se pudo registrar esta cuenta con los datos indicados.",
        );
      const hashed = await hashPassword(password),
        date = new Date().toISOString();
      const row = db
        .prepare(
          "INSERT INTO users(role_id,email,name,phone,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='CUSTOMER'),?,?,?,?,?,?)",
        )
        .run(email, name, phone, hashed, date, date);
      req.createSession(Number(row.lastInsertRowid));
      res.status(201).json({ data: data(req) });
    },
  );
  r.post(
    "/login",
    config.testing ? (q, s, n) => n() : loginLimit(),
    async (req, res) => {
      fields(req.body, ["email", "password"]);
      const { email, password } = credentials(req.body);
      const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
      const valid = await verifyPassword(password, u?.password_hash);
      if (!valid || !u?.is_active)
        fail(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos.");
      req.createSession(u.id);
      res.json({ data: data(req) });
    },
  );
  r.post("/logout", (req, res) => {
    if (req.session)
      db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    res.clearCookie("jm.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.origin.startsWith("https:"),
    });
    res.status(204).end();
  });
  return r;
}
