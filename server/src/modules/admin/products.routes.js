import { Router } from "express";
import { product } from "../catalog/catalog.service.js";
import { productInput } from "./products.service.js";
import { saveImages } from "./image-library.js";
import { transaction } from "../../db/connection.js";
import {
  fields,
  text,
  integer,
  flag,
  version,
  pagination,
} from "../../lib/validation.js";
import { fail, notFound } from "../../lib/errors.js";
const list = (res, rows, q) => {
  const { page, pageSize } = pagination(q);
  res.json({
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: rows.length },
  });
};
export function productsRoutes(db) {
  const r = Router();
  r.get("/products", (req, res) => {
    let rows = db
      .prepare("SELECT id FROM products ORDER BY id DESC")
      .all()
      .map((x) => product(db, x.id, true));
    if (req.query.q)
      rows = rows.filter((p) =>
        (p.name + " " + p.sku)
          .toLowerCase()
          .includes(req.query.q.toLowerCase()),
      );
    if (req.query.status)
      rows = rows.filter(
        (p) => p.is_active === Number(req.query.status === "active"),
      );
    if (req.query.category)
      rows = rows.filter((p) => String(p.category_id) === req.query.category);
    list(res, rows, req.query);
  });
  r.post("/products", (req, res) => {
    fields(req.body, [
      "categoryId",
      "sku",
      "slug",
      "name",
      "description",
      "basePriceCents",
      "isActive",
      "isFeatured",
      "initialStock",
      "images",
    ]);
    const values = productInput(db, req.body),
      stock = integer(req.body.initialStock, "initialStock", 0, 1000000);
    const p = transaction(db, () => {
      const row = db
          .prepare(
            "INSERT INTO products(category_id,sku,slug,name,description,base_price_cents,is_active,is_featured) VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(...values),
        id = Number(row.lastInsertRowid),
        date = new Date().toISOString();
      db.prepare(
        "INSERT INTO inventory(product_id,quantity,updated_at) VALUES(?,?,?)",
      ).run(id, stock, date);
      db.prepare(
        "INSERT INTO inventory_movements(product_id,actor_user_id,kind,delta,quantity_after,reason,created_at) VALUES(?,?,'SEED',?,?,?,?)",
      ).run(id, req.user.id, stock, stock, "Alta administrativa", date);
      saveImages(db, id, req.body.images || []);
      return product(db, id, true);
    });
    res.status(201).json({ data: p });
  });
  r.patch("/products/:id", (req, res) => {
    fields(req.body, [
      "version",
      "categoryId",
      "sku",
      "slug",
      "name",
      "description",
      "basePriceCents",
      "isActive",
      "isFeatured",
    ]);
    const p = product(db, req.params.id, true);
    version(req.body.version, p.version);
    const b = {
      categoryId: p.category_id,
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      description: p.description,
      basePriceCents: p.base_price_cents,
      isActive: !!p.is_active,
      isFeatured: !!p.is_featured,
      ...req.body,
    };
    const values = productInput(db, b);
    const promo = db
      .prepare(
        "SELECT * FROM promotions WHERE product_id=? AND kind='FINAL_PRICE' AND is_active=1 AND value>=?",
      )
      .get(p.id, b.basePriceCents);
    if (promo)
      fail(
        422,
        "VALIDATION",
        "Desactiva la promoción incompatible antes de bajar el precio base.",
      );
    db.prepare(
      "UPDATE products SET category_id=?,sku=?,slug=?,name=?,description=?,base_price_cents=?,is_active=?,is_featured=?,version=version+1 WHERE id=?",
    ).run(...values, p.id);
    res.json({ data: product(db, p.id, true) });
  });
  r.delete("/products/:id", (req, res) => {
    const p = product(db, req.params.id, true);
    version(req.body.version, p.version);
    db.prepare(
      "UPDATE products SET is_active=0,version=version+1 WHERE id=?",
    ).run(p.id);
    res.status(204).end();
  });
  r.get("/categories", (req, res) =>
    list(
      res,
      db.prepare("SELECT * FROM categories ORDER BY id").all(),
      req.query,
    ),
  );
  r.post("/categories", (req, res) => {
    fields(req.body, ["name", "slug", "isActive"]);
    const name = text(req.body.name, "name", 2, 80),
      slug = text(req.body.slug, "slug", 1, 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      fail(422, "VALIDATION", "Slug no válido.");
    const row = db
      .prepare("INSERT INTO categories(name,slug,is_active) VALUES(?,?,?)")
      .run(name, slug, flag(req.body.isActive, "isActive"));
    res
      .status(201)
      .json({
        data: db
          .prepare("SELECT * FROM categories WHERE id=?")
          .get(Number(row.lastInsertRowid)),
      });
  });
  r.patch("/categories/:id", (req, res) => {
    fields(req.body, ["name", "slug", "isActive", "version"]);
    const c = db
      .prepare("SELECT * FROM categories WHERE id=?")
      .get(req.params.id);
    if (!c) notFound();
    version(req.body.version, c.version);
    const name = text(req.body.name ?? c.name, "name", 2, 80),
      slug = text(req.body.slug ?? c.slug, "slug", 1, 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      fail(422, "VALIDATION", "Slug no válido.");
    db.prepare(
      "UPDATE categories SET name=?,slug=?,is_active=?,version=version+1 WHERE id=?",
    ).run(
      name,
      slug,
      req.body.isActive === undefined
        ? c.is_active
        : flag(req.body.isActive, "isActive"),
      c.id,
    );
    res.json({
      data: db.prepare("SELECT * FROM categories WHERE id=?").get(c.id),
    });
  });
  r.delete("/categories/:id", (req, res) => {
    const c = db
      .prepare("SELECT * FROM categories WHERE id=?")
      .get(req.params.id);
    if (!c) notFound();
    version(req.body.version, c.version);
    db.prepare(
      "UPDATE categories SET is_active=0,version=version+1 WHERE id=?",
    ).run(c.id);
    res.status(204).end();
  });
  return r;
}
