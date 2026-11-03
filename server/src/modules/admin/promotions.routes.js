import { Router } from "express";
import { promotionInput } from "./promotions.service.js";
import { fields, version, pagination } from "../../lib/validation.js";
import { notFound } from "../../lib/errors.js";
export function promotionsRoutes(db) {
  const r = Router();
  r.get("/promotions", (req, res) => {
    const { page, pageSize } = pagination(req.query);
    const all = db.prepare("SELECT * FROM promotions ORDER BY id DESC").all();
    res.json({
      data: all.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: all.length },
    });
  });
  r.post("/promotions", (req, res) => {
    fields(req.body, [
      "productId",
      "categoryId",
      "kind",
      "value",
      "startsAt",
      "endsAt",
      "terms",
      "isActive",
    ]);
    const row = db
      .prepare(
        "INSERT INTO promotions(product_id,category_id,kind,value,starts_at,ends_at,terms,is_active) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(...promotionInput(db, req.body));
    res
      .status(201)
      .json({
        data: db
          .prepare("SELECT * FROM promotions WHERE id=?")
          .get(Number(row.lastInsertRowid)),
      });
  });
  r.patch("/promotions/:id", (req, res) => {
    fields(req.body, [
      "version",
      "productId",
      "categoryId",
      "kind",
      "value",
      "startsAt",
      "endsAt",
      "terms",
      "isActive",
    ]);
    const p = db
      .prepare("SELECT * FROM promotions WHERE id=?")
      .get(req.params.id);
    if (!p) notFound();
    version(req.body.version, p.version);
    const b = {
      productId: p.product_id,
      categoryId: p.category_id,
      kind: p.kind,
      value: p.value,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      terms: p.terms,
      isActive: !!p.is_active,
      ...req.body,
    };
    db.prepare(
      "UPDATE promotions SET product_id=?,category_id=?,kind=?,value=?,starts_at=?,ends_at=?,terms=?,is_active=?,version=version+1 WHERE id=?",
    ).run(...promotionInput(db, b, p.id), p.id);
    res.json({
      data: db.prepare("SELECT * FROM promotions WHERE id=?").get(p.id),
    });
  });
  r.delete("/promotions/:id", (req, res) => {
    const p = db
      .prepare("SELECT * FROM promotions WHERE id=?")
      .get(req.params.id);
    if (!p) notFound();
    version(req.body.version, p.version);
    db.prepare(
      "UPDATE promotions SET is_active=0,version=version+1 WHERE id=?",
    ).run(p.id);
    res.status(204).end();
  });
  return r;
}
