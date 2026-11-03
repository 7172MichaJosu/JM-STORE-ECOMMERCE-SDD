import { Router } from "express";
import { customerOnly } from "../../middleware/auth.js";
import { fields, text, version, pagination } from "../../lib/validation.js";
import { notFound } from "../../lib/errors.js";
import { safeUser } from "../auth/session.service.js";
export function addressInput(b) {
  return {
    recipient: text(b.recipient, "recipient", 2, 100),
    phone: text(b.phone, "phone", 7, 20),
    region: text(b.region, "region", 2, 100),
    province: text(b.province, "province", 2, 100),
    district: text(b.district, "district", 2, 100),
    street: text(b.street, "street", 5, 200),
    reference: b.reference ? text(b.reference, "reference", 0, 200) : null,
  };
}
export function customerRoutes(db) {
  const r = Router();
  r.use(customerOnly);
  r.get("/", (req, res) => res.json({ data: req.user }));
  r.patch("/", (req, res) => {
    fields(req.body, ["name", "phone"]);
    const name = text(req.body.name, "name", 2, 100),
      phone = req.body.phone ? text(req.body.phone, "phone", 7, 20) : null;
    db.prepare(
      "UPDATE users SET name=?,phone=?,version=version+1,updated_at=? WHERE id=?",
    ).run(name, phone, new Date().toISOString(), req.user.id);
    res.json({ data: safeUser(db, req.user.id) });
  });
  r.get("/addresses", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const rows = db
      .prepare(
        "SELECT * FROM addresses WHERE user_id=? AND is_active=1 ORDER BY id",
      )
      .all(req.user.id);
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.post("/addresses", (req, res) => {
    fields(req.body, [
      "recipient",
      "phone",
      "region",
      "province",
      "district",
      "street",
      "reference",
    ]);
    const a = addressInput(req.body);
    const row = db
      .prepare(
        "INSERT INTO addresses(user_id,recipient,phone,region,province,district,street,reference) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(req.user.id, ...Object.values(a));
    res
      .status(201)
      .json({
        data: db
          .prepare("SELECT * FROM addresses WHERE id=?")
          .get(Number(row.lastInsertRowid)),
      });
  });
  r.patch("/addresses/:id", (req, res) => {
    fields(req.body, [
      "recipient",
      "phone",
      "region",
      "province",
      "district",
      "street",
      "reference",
      "version",
    ]);
    const a = db
      .prepare(
        "SELECT * FROM addresses WHERE id=? AND user_id=? AND is_active=1",
      )
      .get(req.params.id, req.user.id);
    if (!a) notFound();
    version(req.body.version, a.version);
    const values = addressInput({ ...a, ...req.body });
    db.prepare(
      "UPDATE addresses SET recipient=?,phone=?,region=?,province=?,district=?,street=?,reference=?,version=version+1 WHERE id=?",
    ).run(...Object.values(values), a.id);
    res.json({
      data: db.prepare("SELECT * FROM addresses WHERE id=?").get(a.id),
    });
  });
  r.delete("/addresses/:id", (req, res) => {
    const a = db
      .prepare(
        "SELECT * FROM addresses WHERE id=? AND user_id=? AND is_active=1",
      )
      .get(req.params.id, req.user.id);
    if (!a) notFound();
    version(req.body.version, a.version);
    db.prepare(
      "UPDATE addresses SET is_active=0,version=version+1 WHERE id=?",
    ).run(a.id);
    res.status(204).end();
  });
  return r;
}
