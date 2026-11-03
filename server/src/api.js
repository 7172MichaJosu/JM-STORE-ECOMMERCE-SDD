import { queryValidation } from "./middleware/query-validation.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { sessionMiddleware } from "./modules/auth/session.service.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { csrf } from "./middleware/csrf.js";
import { limiter } from "./middleware/rate-limit.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";
import { checkoutRoutes } from "./modules/checkout/checkout.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
export function installApi({ app, db, config }) {
  app.use("/api", sessionMiddleware(db, config));
  if (!config.testing) app.use("/api", limiter(300));
  app.use("/api", queryValidation, csrf(config.origin));
  app.use("/api/auth", authRoutes(db, config));
  app.use("/api/me", customerRoutes(db));
  app.use("/api/cart", cartRoutes(db));
  app.use("/api/admin", adminRoutes(db));
  app.use("/api", checkoutRoutes(db, config));
  app.use("/api/orders", ordersRoutes(db));
  app.use("/api", catalogRoutes(db));
}
