import { Router } from "express";
import {
  fields,
  text,
  flag,
  version,
  pagination,
} from "../../lib/validation.js";
import { notFound } from "../../lib/errors.js";
import { transaction } from "../../db/connection.js";
const select =
  "SELECT u.id,u.name,u.email,u.phone,u.is_active,u.version,u.created_at FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='CUSTOMER'";
export function customersRoutes(db) {
  const r = Router();
  r.get("/customers", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    let rows = db.prepare(select + " ORDER BY u.id DESC").all();
    if (req.query.q)
      rows = rows.filter((x) =>
        (x.name + x.email).toLowerCase().includes(req.query.q.toLowerCase()),
      );
    if (req.query.status)
      rows = rows.filter(
        (x) => x.is_active === Number(req.query.status === "active"),
      );
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.get("/customers/:id", (req, res) => {
    const u = db.prepare(select + " AND u.id=?").get(req.params.id);
    if (!u) notFound();
    res.json({
      data: {
        ...u,
        orders: db
          .prepare(
            "SELECT public_id,status,total_cents FROM orders WHERE user_id=?",
          )
          .all(u.id),
      },
    });
  });
  r.patch("/customers/:id", (req, res) => {
    fields(req.body, ["version", "name", "phone", "isActive"]);
    const u = db.prepare(select + " AND u.id=?").get(req.params.id);
    if (!u) notFound();
    version(req.body.version, u.version);
    const name = text(req.body.name ?? u.name, "name", 2, 100),
      phone =
        req.body.phone === undefined
          ? u.phone
          : req.body.phone
            ? text(req.body.phone, "phone", 7, 20)
            : null,
      active =
        req.body.isActive === undefined
          ? u.is_active
          : flag(req.body.isActive, "isActive");
    transaction(db, () => {
      db.prepare(
        "UPDATE users SET name=?,phone=?,is_active=?,version=version+1,updated_at=? WHERE id=?",
      ).run(name, phone, active, new Date().toISOString(), u.id);
      if (!active) db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
    });
    res.json({ data: db.prepare(select + " AND u.id=?").get(u.id) });
  });
  return r;
}
