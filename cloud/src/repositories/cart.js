import {
  fail,
  total,
  fields,
  integer,
  version,
} from "../../../shared/domain/index.js";
import { catalogIndex, product } from "./catalog.js";
import { mutate } from "./mutations.js";
export async function get(req) {
  if (req.user?.role === "ADMIN")
    fail(403, "FORBIDDEN", "Usa una cuenta de cliente para comprar.");
  if (!req.session) await req.createSession();
  const user = req.user?.id || null,
    guest = user ? null : req.session.id;
  await req.db.run(
    "INSERT INTO carts(user_id,guest_session_id,updated_at) VALUES(?,?,?) ON CONFLICT DO NOTHING",
    user,
    guest,
    new Date().toISOString(),
  );
  return user
    ? req.db.first("SELECT * FROM carts WHERE user_id=?", user)
    : req.db.first("SELECT * FROM carts WHERE guest_session_id=?", guest);
}
export async function summary(db, cart) {
  const [lines, products] = await Promise.all([
    db.all(
      "SELECT * FROM cart_items WHERE cart_id=? ORDER BY product_id",
      cart.id,
    ),
    catalogIndex(db),
  ]);
  const map = new Map(products.map((p) => [p.id, p]));
  const items = lines.map((l) => {
    const p = map.get(l.product_id);
    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      image: p.images[0]?.path,
      quantity: l.quantity,
      unit_price_cents: p.effective_price_cents,
      line_total_cents: p.effective_price_cents * l.quantity,
      available: p.is_available && p.quantity >= l.quantity,
      available_quantity: p.quantity,
      issue: !p.is_available
        ? "PRODUCT_UNAVAILABLE"
        : p.quantity < l.quantity
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
      .filter((i) => i.issue)
      .map((i) => ({ product_id: i.product_id, code: i.issue })),
  };
}
export async function change(req, remove = false) {
  fields(req.body, remove ? ["cartVersion"] : ["quantity", "cartVersion"]);
  const cart = await get(req);
  version(req.body.cartVersion, cart.version);
  const id = integer(Number(req.params.id), "id", 1);
  let quantity,
    existing = false;
  if (!remove) {
    quantity = integer(req.body.quantity, "quantity", 1, 99);
    const p = await product(req.db, id);
    if (!p.is_available || p.quantity < quantity)
      fail(409, "OUT_OF_STOCK", "La cantidad supera el stock disponible.");
    const count = await req.db.first(
      "SELECT count(*) n,COALESCE(MAX(product_id=?),0) present FROM cart_items WHERE cart_id=?",
      id,
      cart.id,
    );
    existing = !!count.present;
    if (!existing && count.n >= 100)
      fail(422, "CART_LIMIT", "El carrito admite hasta 100 productos.");
  }
  let condition = "EXISTS(SELECT 1 FROM carts WHERE id=? AND version=?)",
    values = [cart.id, cart.version];
  if (!remove) {
    condition +=
      " AND EXISTS(SELECT 1 FROM catalog_products WHERE id=? AND is_active=1 AND category_active=1 AND quantity>=?)";
    values.push(id, quantity);
  }
  const write = remove
    ? req.db.stmt(
        "DELETE FROM cart_items WHERE cart_id=? AND product_id=?",
        cart.id,
        id,
      )
    : existing
      ? req.db.stmt(
          "UPDATE cart_items SET quantity=? WHERE cart_id=? AND product_id=?",
          quantity,
          cart.id,
          id,
        )
      : req.db.stmt(
          "INSERT INTO cart_items VALUES(?,?,?)",
          cart.id,
          id,
          quantity,
        );
  await mutate(req, "CART", condition, values, [
    write,
    req.db.stmt(
      "UPDATE carts SET version=version+1,updated_at=? WHERE id=?",
      new Date().toISOString(),
      cart.id,
    ),
  ]);
  return summary(
    req.db,
    await req.db.first("SELECT * FROM carts WHERE id=?", cart.id),
  );
}
