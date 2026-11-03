import { randomBytes, createHash } from "node:crypto";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const now = () => new Date().toISOString();
export function safeUser(db, id) {
  return (
    db
      .prepare(
        "SELECT u.id,u.name,u.email,u.phone,u.is_active,u.version,r.code role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?",
      )
      .get(id) || null
  );
}
export function sessionMiddleware(db, config) {
  let cleanup = 0;
  return (req, res, next) => {
    if (Date.now() > cleanup) {
      db.prepare(
        "DELETE FROM sessions WHERE expires_at<? OR (user_id IS NOT NULL AND last_seen_at<?)",
      ).run(
        new Date().toISOString(),
        new Date(Date.now() - 1800000).toISOString(),
      );
      cleanup = Date.now() + 60000;
    }
    const raw = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("jm.sid="))
      ?.slice(7);
    let s = raw
      ? db.prepare("SELECT * FROM sessions WHERE token_hash=?").get(hash(raw))
      : null;
    if (
      s &&
      (Date.parse(s.expires_at) < Date.now() ||
        (s.user_id && Date.parse(s.last_seen_at) < Date.now() - 30 * 60 * 1000))
    ) {
      db.prepare("DELETE FROM sessions WHERE id=?").run(s.id);
      s = null;
    }
    req.user = s?.user_id ? safeUser(db, s.user_id) : null;
    if (req.user && !req.user.is_active) {
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.user.id);
      req.user = null;
      s = null;
    }
    req.session = s;
    if (s)
      db.prepare("UPDATE sessions SET last_seen_at=? WHERE id=?").run(
        now(),
        s.id,
      );
    req.createSession = (userId = null) => {
      if (req.session)
        db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
      const token = randomBytes(32).toString("base64url"),
        csrf = randomBytes(32).toString("base64url"),
        date = now(),
        expiry = new Date(
          Date.now() + (userId ? 8 : 24) * 60 * 60 * 1000,
        ).toISOString();
      const r = db
        .prepare(
          "INSERT INTO sessions(token_hash,user_id,csrf_token,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)",
        )
        .run(hash(token), userId, csrf, date, date, expiry);
      req.session = db
        .prepare("SELECT * FROM sessions WHERE id=?")
        .get(Number(r.lastInsertRowid));
      req.user = userId ? safeUser(db, userId) : null;
      res.cookie("jm.sid", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.origin.startsWith("https:"),
        path: "/",
        ...(userId ? { maxAge: 8 * 60 * 60 * 1000 } : {}),
      });
      return req.session;
    };
    next();
  };
}
