import { product } from "../catalog/catalog.service.js";
import { total } from "../../lib/money.js";
import { fail } from "../../lib/errors.js";
export function getCart(db, req) {
  if (req.user?.role === "ADMIN")
    fail(403, "FORBIDDEN", "Usa una cuenta de cliente para comprar.");
  if (!req.session) req.createSession();
  const user = req.user?.id;
  let row = user
    ? db.prepare("SELECT * FROM carts WHERE user_id=?").get(user)
    : db
        .prepare("SELECT * FROM carts WHERE guest_session_id=?")
        .get(req.session.id);
  if (!row) {
    const r = db
      .prepare(
        "INSERT INTO carts(user_id,guest_session_id,updated_at) VALUES(?,?,?)",
      )
      .run(
        user || null,
        user ? null : req.session.id,
        new Date().toISOString(),
      );
    row = db
      .prepare("SELECT * FROM carts WHERE id=?")
      .get(Number(r.lastInsertRowid));
  }
  return row;
}
export function cartSummary(db, cart) {
  const items = db
    .prepare("SELECT * FROM cart_items WHERE cart_id=? ORDER BY product_id")
    .all(cart.id)
    .map((line) => {
      const p = product(db, line.product_id, true);
      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        image: p.images[0]?.path,
        quantity: line.quantity,
        unit_price_cents: p.effective_price_cents,
        line_total_cents: p.effective_price_cents * line.quantity,
        available: p.is_available && p.quantity >= line.quantity,
        available_quantity: p.quantity,
        issue: !p.is_available
          ? "PRODUCT_UNAVAILABLE"
          : p.quantity < line.quantity
            ? "OUT_OF_STOCK"
            : null,
        product_version: p.version,
        inventory_version: p.inventory_version,
        promotion: p.promotion,
      };
    });
  const amount = total(items);
  return {
    cartId: cart.id,
    version: cart.version,
    items,
    subtotal_cents: amount,
    total_cents: amount,
    currency: "PEN",
    issues: items
      .filter((x) => x.issue)
      .map((x) => ({ product_id: x.product_id, code: x.issue })),
  };
}
