import { Router } from "express";
import { changeSecurity } from "../../repositories/admin-security.js";
import { adminOnly, cookieName, cookieOptions } from "../../security/sessions.js";
import { limit } from "../../security/rate-limit.js";
import { changeFirebaseAdminSecurity, pendingFirebaseEmailChange, cancelFirebaseEmailChange } from "../../repositories/firebase-admin-security.js";

export function securityRoutes() {
  const r = Router();
  r.use(adminOnly);
  r.get("/", async (req, res) => {
    const data = await req.db.first("SELECT id,email,version FROM users WHERE id=?", req.user.id);
    res.json({ data });
  });
  r.get("/email-change", async (req, res) => {
    if (!req.config.firebase) return res.json({ data: null });
    res.json({ data: await pendingFirebaseEmailChange(req) });
  });
  r.delete("/email-change", async (req, res) => {
    if (!req.config.firebase) return res.status(404).end();
    res.json({ data: await cancelFirebaseEmailChange(req) });
  });
  r.patch("/", limit("admin-security", 20, 900), async (req, res) => {
    const data = req.config.firebase
      ? await changeFirebaseAdminSecurity(req)
      : await changeSecurity(req);
    if (data.requiresLogin) res.clearCookie(cookieName(req.config), cookieOptions(req.config));
    res.json({ data });
  });
  return r;
}
