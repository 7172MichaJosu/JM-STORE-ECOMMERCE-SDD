import { timingSafeEqual } from "node:crypto";
import { fail } from "../lib/errors.js";
export function csrf(origin) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.get("origin") !== origin)
      fail(403, "CSRF", "Origen de solicitud no permitido.");
    const a = Buffer.from(req.get("x-csrf-token") || ""),
      b = Buffer.from(req.session?.csrf_token || "");
    if (!a.length || a.length !== b.length || !timingSafeEqual(a, b))
      fail(
        403,
        "CSRF",
        "La sesión del formulario cambió. Recarga e intenta de nuevo.",
      );
    next();
  };
}
