import { Router } from "express";
import { adminOnly } from "../../middleware/auth.js";
import { productsRoutes } from "./products.routes.js";
import { imagesRoutes } from "./images.routes.js";
import { promotionsRoutes } from "./promotions.routes.js";
import { inventoryRoutes } from "./inventory.routes.js";
import { customersRoutes } from "./customers.routes.js";
import { adminOrdersRoutes } from "./orders.routes.js";
export function adminRoutes(db) {
  const r = Router();
  r.use(adminOnly);
  r.get("/summary", (req, res) =>
    res.json({
      data: {
        products: db
          .prepare("SELECT COUNT(*) n FROM products WHERE is_active=1")
          .get().n,
        customers: db
          .prepare(
            "SELECT COUNT(*) n FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='CUSTOMER'",
          )
          .get().n,
        orders: db.prepare("SELECT COUNT(*) n FROM orders").get().n,
        lowStock: db
          .prepare("SELECT COUNT(*) n FROM inventory WHERE quantity<=5")
          .get().n,
        confirmedTotal: db
          .prepare(
            "SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE payment_status='APPROVED'",
          )
          .get().n,
      },
    }),
  );
  r.use(
    productsRoutes(db),
    imagesRoutes(db),
    promotionsRoutes(db),
    inventoryRoutes(db),
    customersRoutes(db),
    adminOrdersRoutes(db),
  );
  return r;
}
