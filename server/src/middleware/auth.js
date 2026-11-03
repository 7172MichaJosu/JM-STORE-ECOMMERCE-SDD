import { fail } from "../lib/errors.js";
export function authenticated(req, res, next) {
  if (!req.user) fail(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  next();
}
export function customerOnly(req, res, next) {
  authenticated(req, res, () => {
    if (req.user.role !== "CUSTOMER")
      fail(403, "FORBIDDEN", "Esta acción es para cuentas de cliente.");
    next();
  });
}
export function adminOnly(req, res, next) {
  authenticated(req, res, () => {
    if (req.user.role !== "ADMIN")
      fail(403, "FORBIDDEN", "Necesitas permisos de administrador.");
    next();
  });
}
