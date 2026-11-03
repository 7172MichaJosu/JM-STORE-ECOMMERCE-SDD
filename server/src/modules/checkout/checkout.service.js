import { randomUUID } from "node:crypto";
import { cartSummary, getCart } from "../cart/cart.service.js";
import { product } from "../catalog/catalog.service.js";
import { orderByPublic, orderView } from "../orders/orders.service.js";
import { signQuote, readQuote, fingerprint } from "../../lib/quotes.js";
import { total } from "../../lib/money.js";
import { fail, notFound } from "../../lib/errors.js";
import { transaction } from "../../db/connection.js";
import { idempotency } from "../../lib/idempotency.js";
export function summary(db, req, scope, addressId, publicId) {
  let items, address, source, sourceVersion, sourceId;
  if (scope === "CART") {
    source = getCart(db, req);
    const cart = cartSummary(db, source);
    if (!cart.items.length) fail(409, "CART_EMPTY", "Tu carrito está vacío.");
    items = cart.items;
    address = db
      .prepare(
        "SELECT * FROM addresses WHERE id=? AND user_id=? AND is_active=1",
      )
      .get(addressId, req.user.id);
    if (!address) notFound();
    sourceVersion = source.version;
    sourceId = source.id;
  } else {
    source = orderByPublic(db, publicId, req.user.id);
    if (source.payment_status === "APPROVED")
      fail(409, "ORDER_ALREADY_PAID", "El pedido ya está confirmado.");
    items = db
      .prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY product_id")
      .all(source.id)
      .map((i) => {
        const p = product(db, i.product_id);
        if (p.effective_price_cents !== i.unit_price_cents)
          fail(
            409,
            "NEW_CHECKOUT_REQUIRED",
            "El precio cambió. Conservamos este pedido; revisa una nueva compra en el carrito.",
          );
        return {
          product_id: p.id,
          sku: i.sku_snapshot,
          name: i.name_snapshot,
          quantity: i.quantity,
          unit_price_cents: i.unit_price_cents,
          line_total_cents: i.line_total_cents,
          available: p.is_available && p.quantity >= i.quantity,
          product_version: p.version,
          inventory_version: p.inventory_version,
          promotion: p.promotion,
        };
      });
    address = {
      recipient: source.recipient_snapshot,
      phone: source.phone_snapshot,
      region: source.region_snapshot,
      province: source.province_snapshot,
      district: source.district_snapshot,
      street: source.street_snapshot,
      reference: source.reference_snapshot,
    };
    sourceVersion = source.version;
    sourceId = source.public_id;
  }
  if (items.some((x) => !x.available))
    fail(
      409,
      "OUT_OF_STOCK",
      "Algunos productos ya no tienen la disponibilidad solicitada.",
    );
  const amount = total(items);
  const snap = {
    scope,
    sourceId,
    sourceVersion,
    items: items.map((i) => ({
      id: i.product_id,
      q: i.quantity,
      price: i.unit_price_cents,
      p: i.product_version,
      s: i.inventory_version,
      promotion: i.promotion?.id || null,
      promoVersion: i.promotion?.version || null,
    })),
    address,
  };
  return {
    source,
    sourceId,
    sourceVersion,
    items,
    address,
    subtotal_cents: amount,
    total_cents: amount,
    currency: "PEN",
    fingerprint: fingerprint(snap),
  };
}
export function quote(db, req, config, scope, addressId, publicId) {
  const s = summary(db, req, scope, addressId, publicId);
  const token = signQuote(
    {
      userId: req.user.id,
      scope,
      sourceId: s.sourceId,
      sourceVersion: s.sourceVersion,
      addressId: addressId || null,
      fingerprint: s.fingerprint,
    },
    config.quoteSecret,
  );
  return {
    quoteToken: token,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    sourceType: scope,
    sourceId: s.sourceId,
    sourceVersion: s.sourceVersion,
    items: s.items,
    addressSummary: s.address,
    subtotal_cents: s.total_cents,
    total_cents: s.total_cents,
    currency: "PEN",
    simulationOnly: true,
  };
}
export function pay(db, req, config, publicId) {
  return transaction(db, () =>
    idempotency(
      db,
      req.user.id,
      publicId ? "pay-order:" + publicId : "create-order",
      req.get("Idempotency-Key"),
      req.body,
      () => {
        const q = readQuote(req.body.quoteToken, config.quoteSecret),
          scope = publicId ? "ORDER" : "CART";
        if (
          q.userId !== req.user.id ||
          q.scope !== scope ||
          (publicId && q.sourceId !== publicId)
        )
          fail(
            409,
            "QUOTE_CHANGED",
            "El resumen no corresponde a esta operación.",
          );
        if (
          !publicId &&
          db.prepare("SELECT 1 FROM orders WHERE creation_nonce=?").get(q.nonce)
        )
          fail(
            409,
            "DUPLICATE_CHECKOUT",
            "Este resumen ya registró un pedido. Revisa tu historial.",
          );
        const s = summary(db, req, scope, q.addressId, publicId);
        if (
          s.fingerprint !== q.fingerprint ||
          s.sourceVersion !== q.sourceVersion
        )
          fail(
            409,
            "QUOTE_CHANGED",
            "El precio, stock o resumen cambió. Revísalo y vuelve a confirmar.",
          );
        const approved = req.body.simulationOutcome === "APPROVED",
          date = new Date().toISOString();
        let o = s.source;
        if (!publicId) {
          const a = s.address;
          const r = db
            .prepare(
              "INSERT INTO orders(public_id,creation_nonce,user_id,status,payment_status,subtotal_cents,total_cents,recipient_snapshot,phone_snapshot,region_snapshot,province_snapshot,district_snapshot,street_snapshot,reference_snapshot,source_cart_id,source_cart_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .run(
              randomUUID(),
              q.nonce,
              req.user.id,
              approved ? "CONFIRMED" : "AWAITING_PAYMENT",
              req.body.simulationOutcome,
              s.total_cents,
              s.total_cents,
              a.recipient,
              a.phone,
              a.region,
              a.province,
              a.district,
              a.street,
              a.reference || null,
              s.sourceId,
              s.sourceVersion,
              date,
              date,
            );
          o = db
            .prepare("SELECT * FROM orders WHERE id=?")
            .get(Number(r.lastInsertRowid));
          for (const i of s.items)
            db.prepare(
              "INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_cents,quantity,line_total_cents,promotion_snapshot) VALUES(?,?,?,?,?,?,?,?)",
            ).run(
              o.id,
              i.product_id,
              i.sku,
              i.name,
              i.unit_price_cents,
              i.quantity,
              i.line_total_cents,
              i.promotion ? JSON.stringify(i.promotion) : null,
            );
          db.prepare(
            "INSERT INTO order_status_history(order_id,to_status,actor_user_id,created_at) VALUES(?,?,?,?)",
          ).run(o.id, o.status, req.user.id, date);
        } else {
          db.prepare(
            "UPDATE orders SET status=?,payment_status=?,version=version+1,updated_at=? WHERE id=?",
          ).run(
            approved ? "CONFIRMED" : "AWAITING_PAYMENT",
            req.body.simulationOutcome,
            date,
            o.id,
          );
          if (approved)
            db.prepare(
              "INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id,created_at) VALUES(?,'AWAITING_PAYMENT','CONFIRMED',?,?)",
            ).run(o.id, req.user.id, date);
        }
        db.prepare(
          "INSERT INTO simulated_payments(order_id,outcome,amount_cents,currency,created_at) VALUES(?,?,?,'PEN',?)",
        ).run(o.id, req.body.simulationOutcome, o.total_cents, date);
        if (approved) {
          for (const i of s.items) {
            const changed = db
              .prepare(
                "UPDATE inventory SET quantity=quantity-?,version=version+1,updated_at=? WHERE product_id=? AND quantity>=?",
              )
              .run(i.quantity, date, i.product_id, i.quantity);
            if (!changed.changes)
              fail(409, "OUT_OF_STOCK", "No hay stock suficiente.");
            const quantity = db
              .prepare("SELECT quantity FROM inventory WHERE product_id=?")
              .get(i.product_id).quantity;
            db.prepare(
              "INSERT INTO inventory_movements(product_id,order_id,actor_user_id,kind,delta,quantity_after,reason,created_at) VALUES(?,?,?,'SALE',?,?,?,?)",
            ).run(
              i.product_id,
              o.id,
              req.user.id,
              -i.quantity,
              quantity,
              "Compra con pago simulado aprobado",
              date,
            );
          }
          const cart = db
            .prepare("SELECT * FROM carts WHERE id=?")
            .get(o.source_cart_id);
          if (cart && cart.version === o.source_cart_version) {
            db.prepare("DELETE FROM cart_items WHERE cart_id=?").run(cart.id);
            db.prepare(
              "UPDATE carts SET version=version+1,updated_at=? WHERE id=?",
            ).run(date, cart.id);
          }
        }
        return orderView(
          db,
          db.prepare("SELECT * FROM orders WHERE id=?").get(o.id),
        );
      },
    ),
  );
}
