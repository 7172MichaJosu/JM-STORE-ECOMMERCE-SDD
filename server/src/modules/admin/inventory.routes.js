import { Router } from "express";
import {
  fields,
  integer,
  text,
  version,
  pagination,
} from "../../lib/validation.js";
import { fail, notFound } from "../../lib/errors.js";
import { transaction } from "../../db/connection.js";
export function inventoryRoutes(db) {
  const r = Router();
  r.get("/inventory", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    let rows = db
      .prepare(
        "SELECT i.*,p.name,p.sku FROM inventory i JOIN products p ON p.id=i.product_id ORDER BY product_id",
      )
      .all();
    if (req.query.q)
      rows = rows.filter((x) =>
        (x.name + x.sku).toLowerCase().includes(req.query.q.toLowerCase()),
      );
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.post("/inventory/:id/adjustments", (req, res) => {
    fields(req.body, ["expectedVersion", "newQuantity", "reason"]);
    const qty = integer(req.body.newQuantity, "newQuantity", 0, 1000000),
      reason = text(req.body.reason, "reason", 3, 200);
    const result = transaction(db, () => {
      const i = db
        .prepare("SELECT * FROM inventory WHERE product_id=?")
        .get(req.params.id);
      if (!i) notFound();
      version(req.body.expectedVersion, i.version);
      if (qty === i.quantity)
        fail(422, "VALIDATION", "Indica una cantidad diferente para ajustar.");
      const date = new Date().toISOString();
      db.prepare(
        "UPDATE inventory SET quantity=?,version=version+1,updated_at=? WHERE product_id=?",
      ).run(qty, date, i.product_id);
      const row = db
        .prepare(
          "INSERT INTO inventory_movements(product_id,actor_user_id,kind,delta,quantity_after,reason,created_at) VALUES(?,?,'ADJUSTMENT',?,?,?,?)",
        )
        .run(i.product_id, req.user.id, qty - i.quantity, qty, reason, date);
      return db
        .prepare("SELECT * FROM inventory_movements WHERE id=?")
        .get(Number(row.lastInsertRowid));
    });
    res.status(201).json({ data: result });
  });
  r.get("/inventory/:id/movements", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const rows = db
      .prepare(
        "SELECT * FROM inventory_movements WHERE product_id=? ORDER BY id DESC",
      )
      .all(req.params.id);
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  return r;
}
