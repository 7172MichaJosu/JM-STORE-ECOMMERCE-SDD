import { Router } from "express";
import { product } from "./catalog.service.js";
import { fields, pagination, integer } from "../../lib/validation.js";
import { fail, notFound } from "../../lib/errors.js";
export function catalogRoutes(db) {
  const r = Router();
  r.get("/categories", (req, res) => {
    fields(req.query, ["page", "pageSize"]);
    const { page, pageSize } = pagination(req.query);
    const rows = db
      .prepare(
        "SELECT id,name,slug FROM categories WHERE is_active=1 ORDER BY id",
      )
      .all();
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.get("/products", (req, res) => {
    fields(req.query, [
      "q",
      "category",
      "minPriceCents",
      "maxPriceCents",
      "inStock",
      "featured",
      "page",
      "pageSize",
      "sort",
    ]);
    const q = req.query;
    const { page, pageSize } = pagination(q);
    if ((q.q || "").length > 100)
      fail(422, "VALIDATION", "Búsqueda demasiado larga.");
    let min = Number(q.minPriceCents || 0),
      max = Number(q.maxPriceCents || 100000000);
    integer(min, "minPriceCents", 0, 100000000);
    integer(max, "maxPriceCents", 0, 100000000);
    if (min > max)
      fail(422, "VALIDATION", "El mínimo no puede superar el máximo.");
    if (
      q.sort &&
      !["relevance", "price_asc", "price_desc", "name"].includes(q.sort)
    )
      fail(422, "VALIDATION", "Orden no permitido.");
    for (const key of ["inStock", "featured"])
      if (q[key] && !["true", "false"].includes(q[key]))
        fail(422, "VALIDATION", "Filtro no permitido.");
    let rows = db
      .prepare("SELECT id FROM products WHERE is_active=1 ORDER BY id")
      .all()
      .map((x) => {
        try {
          return product(db, x.id);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const term = (q.q || "").trim().toLocaleLowerCase("es");
    rows = rows.filter(
      (p) =>
        (!term ||
          (p.name + " " + p.description)
            .toLocaleLowerCase("es")
            .includes(term)) &&
        (!q.category ||
          p.category.slug === q.category ||
          String(p.category.id) === q.category) &&
        p.effective_price_cents >= min &&
        p.effective_price_cents <= max &&
        (q.inStock !== "true" || p.is_available) &&
        (q.featured !== "true" || p.is_featured),
    );
    if (q.sort === "price_asc")
      rows.sort((a, b) => a.effective_price_cents - b.effective_price_cents);
    if (q.sort === "price_desc")
      rows.sort((a, b) => b.effective_price_cents - a.effective_price_cents);
    if (q.sort === "name")
      rows.sort((a, b) => a.name.localeCompare(b.name, "es"));
    res.json({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { page, pageSize, total: rows.length },
    });
  });
  r.get("/products/:slug", (req, res) => {
    const p = db
      .prepare("SELECT id FROM products WHERE slug=?")
      .get(req.params.slug);
    if (!p) notFound();
    res.json({ data: product(db, p.id) });
  });
  return r;
}
