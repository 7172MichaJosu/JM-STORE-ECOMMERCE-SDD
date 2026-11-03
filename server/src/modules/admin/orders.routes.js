import { Router } from "express";
import { fields, version, pagination } from "../../lib/validation.js";
import { fail } from "../../lib/errors.js";
import { orderByPublic, orderView } from "../orders/orders.service.js";
import { transaction } from "../../db/connection.js";
export function adminOrdersRoutes(db) {
  const r = Router();
  r.get("/orders", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    let rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
    if (req.query.status)
      rows = rows.filter((o) => o.status === req.query.status);
    if (req.query.paymentStatus)
      rows = rows.filter((o) => o.payment_status === req.query.paymentStatus);
    res.json({
      data: rows
        .slice((page - 1) * pageSize, page * pageSize)
        .map((o) => orderView(db, o)),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.get("/orders/:id", (req, res) =>
    res.json({ data: orderView(db, orderByPublic(db, req.params.id)) }),
  );
  r.patch("/orders/:id/status", (req, res) => {
    fields(req.body, ["expectedVersion", "status"]);
    const o = orderByPublic(db, req.params.id);
    version(req.body.expectedVersion, o.version);
    const next = {
      CONFIRMED: "PREPARING",
      PREPARING: "SHIPPED",
      SHIPPED: "DELIVERED",
    }[o.status];
    if (!next || req.body.status !== next)
      fail(409, "INVALID_TRANSITION", "El cambio de estado no está permitido.");
    transaction(db, () => {
      const date = new Date().toISOString();
      db.prepare(
        "UPDATE orders SET status=?,version=version+1,updated_at=? WHERE id=?",
      ).run(next, date, o.id);
      db.prepare(
        "INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id,created_at) VALUES(?,?,?,?,?)",
      ).run(o.id, o.status, next, req.user.id, date);
    });
    res.json({ data: orderView(db, orderByPublic(db, o.public_id)) });
  });
  return r;
}
