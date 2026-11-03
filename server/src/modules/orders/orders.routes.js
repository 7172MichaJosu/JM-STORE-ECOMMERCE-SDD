import { Router } from "express";
import { customerOnly } from "../../middleware/auth.js";
import { orderByPublic, orderView } from "./orders.service.js";
import { pagination } from "../../lib/validation.js";
export function ordersRoutes(db) {
  const r = Router();
  r.use(customerOnly);
  r.get("/", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const rows = db
      .prepare("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC")
      .all(req.user.id);
    res.json({
      data: rows
        .slice((page - 1) * pageSize, page * pageSize)
        .map((o) => orderView(db, o)),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.get("/:id", (req, res) =>
    res.json({
      data: orderView(db, orderByPublic(db, req.params.id, req.user.id)),
    }),
  );
  return r;
}
