import { Router } from "express";
import { adminOnly } from "../../security/sessions.js";
import { page, id } from "../../repositories/admin-common.js";
import * as products from "../../repositories/admin-products.js";
import * as catalog from "../../repositories/admin-catalog.js";
import * as operations from "../../repositories/admin-operations.js";
export function adminRoutes() {
  const r = Router(); r.use(adminOnly);
  r.get("/summary", async (req, res) => res.json({ data: await req.db.first("SELECT (SELECT COUNT(*) FROM products WHERE is_active=1) products,(SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='CUSTOMER') customers,(SELECT COUNT(*) FROM orders) orders,(SELECT COUNT(*) FROM inventory WHERE quantity<=5) lowStock,(SELECT COALESCE(SUM(total_cents),0) FROM orders WHERE payment_status='APPROVED') confirmedTotal") }));
  r.get("/products", async (req, res) => res.json(page(await products.listProducts(req), req.query)));
  r.post("/products", async (req, res) => res.status(201).json({ data: await products.createProduct(req) }));
  r.patch("/products/:id", async (req, res) => res.json({ data: await products.changeProduct(req) }));
  r.delete("/products/:id", async (req, res) => { await products.changeProduct(req, true); res.status(204).end(); });
  r.get("/image-library", (_req, res) => res.json({ data: products.imageLibrary() }));
  r.put("/products/:id/images", async (req, res) => res.json({ data: await products.changeImages(req) }));
  for (const [path, table, save] of [["categories", "categories", catalog.saveCategory], ["promotions", "promotions", catalog.savePromotion]]) {
    r.get(`/${path}`, async (req, res) => res.json(page(await req.db.all(`SELECT * FROM ${table} ORDER BY id DESC`), req.query)));
    r.post(`/${path}`, async (req, res) => res.status(201).json({ data: await save(req) }));
    r.patch(`/${path}/:id`, async (req, res) => res.json({ data: await save(req) }));
    r.delete(`/${path}/:id`, async (req, res) => { await save(req, true); res.status(204).end(); });
  }
  r.get("/inventory", async (req, res) => {
    let rows = await req.db.all("SELECT i.*,p.name,p.sku FROM inventory i JOIN products p ON p.id=i.product_id ORDER BY product_id");
    if (req.query.q) rows = rows.filter(row => (row.name + row.sku).toLowerCase().includes(req.query.q.toLowerCase()));
    res.json(page(rows, req.query));
  });
  r.post("/inventory/:id/adjustments", async (req, res) => res.status(201).json({ data: await operations.adjustInventory(req) }));
  r.get("/inventory/:id/movements", async (req, res) => res.json(page(await req.db.all("SELECT * FROM inventory_movements WHERE product_id=? ORDER BY id DESC", id(req.params.id)), req.query)));
  r.get("/customers", async (req, res) => {
    let rows = await req.db.all(operations.customerSelect + " ORDER BY u.id DESC");
    if (req.query.q) rows = rows.filter(row => (row.name + row.email).toLowerCase().includes(req.query.q.toLowerCase()));
    if (req.query.status) rows = rows.filter(row => row.is_active === Number(req.query.status === "active"));
    res.json(page(rows, req.query));
  });
  r.get("/customers/:id", async (req, res) => res.json({ data: { ...await operations.customer(req), orders: await req.db.all("SELECT public_id,status,total_cents FROM orders WHERE user_id=?", id(req.params.id)) } }));
  r.patch("/customers/:id", async (req, res) => res.json({ data: await operations.changeCustomer(req) }));
  r.get("/orders", async (req, res) => {
    let rows = (await req.db.all("SELECT document FROM order_documents ORDER BY id DESC")).map(row => JSON.parse(row.document));
    if (req.query.status) rows = rows.filter(row => row.status === req.query.status);
    if (req.query.paymentStatus) rows = rows.filter(row => row.paymentStatus === req.query.paymentStatus);
    res.json(page(rows, req.query));
  });
  r.get("/orders/:id", async (req, res) => res.json({ data: await operations.orderDocument(req) }));
  r.patch("/orders/:id/status", async (req, res) => res.json({ data: await operations.changeOrder(req) }));
  return r;
}
