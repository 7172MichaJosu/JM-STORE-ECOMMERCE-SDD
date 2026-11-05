import { Router } from "express";
import { fail } from "../../../../shared/domain/index.js";
import { confirmFirebaseEmailChange } from "../../repositories/firebase-admin-security.js";
import { cookieName, cookieOptions } from "../../security/sessions.js";
import { limit } from "../../security/rate-limit.js";

export function emailActionRoutes() {
  const router = Router();
  router.post("/confirm", limit("email-change-confirm", 10, 900), async (req, res) => {
    if (!req.config.firebase) fail(404, "NOT_FOUND", "Ruta no encontrada.");
    const data = await confirmFirebaseEmailChange(req);
    res.clearCookie(cookieName(req.config), cookieOptions(req.config));
    res.json({ data });
  });
  return router;
}
