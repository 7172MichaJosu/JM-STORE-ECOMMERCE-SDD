import { Router } from "express";
import { getCart, cartSummary } from "./cart.service.js";
import { fields, integer, version } from "../../lib/validation.js";
import { product } from "../catalog/catalog.service.js";
import { fail } from "../../lib/errors.js";
import { transaction } from "../../db/connection.js";
export function cartRoutes(db) {
  const r = Router();
  r.get("/", (req, res) =>
    res.json({ data: cartSummary(db, getCart(db, req)) }),
  );
  r.put("/items/:id", (req, res) => {
    fields(req.body, ["quantity", "cartVersion"]);
    const quantity = integer(req.body.quantity, "quantity", 1, 99);
    const result = transaction(db, () => {
      const cart = getCart(db, req);
      version(req.body.cartVersion, cart.version);
      const p = product(db, req.params.id);
      if (!p.is_available || p.quantity < quantity)
        fail(409, "OUT_OF_STOCK", "La cantidad supera el stock disponible.");
      const existing = db
        .prepare("SELECT 1 FROM cart_items WHERE cart_id=? AND product_id=?")
        .get(cart.id, p.id);
      if (
        !existing &&
        db
          .prepare("SELECT COUNT(*) n FROM cart_items WHERE cart_id=?")
          .get(cart.id).n >= 100
      )
        fail(422, "CART_LIMIT", "El carrito admite hasta 100 productos.");
      if (existing)
        db.prepare(
          "UPDATE cart_items SET quantity=? WHERE cart_id=? AND product_id=?",
        ).run(quantity, cart.id, p.id);
      else
        db.prepare("INSERT INTO cart_items VALUES(?,?,?)").run(
          cart.id,
          p.id,
          quantity,
        );
      db.prepare(
        "UPDATE carts SET version=version+1,updated_at=? WHERE id=?",
      ).run(new Date().toISOString(), cart.id);
      return cartSummary(
        db,
        db.prepare("SELECT * FROM carts WHERE id=?").get(cart.id),
      );
    });
    res.json({ data: result });
  });
  r.delete("/items/:id", (req, res) => {
    fields(req.body, ["cartVersion"]);
    const cart = getCart(db, req);
    version(req.body.cartVersion, cart.version);
    transaction(db, () => {
      db.prepare("DELETE FROM cart_items WHERE cart_id=? AND product_id=?").run(
        cart.id,
        req.params.id,
      );
      db.prepare(
        "UPDATE carts SET version=version+1,updated_at=? WHERE id=?",
      ).run(new Date().toISOString(), cart.id);
    });
    res.json({
      data: cartSummary(
        db,
        db.prepare("SELECT * FROM carts WHERE id=?").get(cart.id),
      ),
    });
  });
  return r;
}
