import { randomUUID } from "node:crypto";
import { fail, notFound, total } from "../../../shared/domain/index.js";
import {
  signQuote,
  readQuote,
  fingerprint,
} from "../../../server/src/lib/quotes.js";
import * as carts from "./cart.js";
import * as orders from "./orders.js";
import { catalogIndex } from "./catalog.js";
import { guard } from "./mutations.js";

export async function summary(req, scope, addressId, publicId) {
  let source, items, address, sourceId, sourceVersion;
  if (scope === "CART") {
    source = await carts.get(req);
    const cart = await carts.summary(req.db, source);
    if (!cart.items.length) fail(409, "CART_EMPTY", "Tu carrito está vacío.");
    items = cart.items;
    address = await req.db.first(
      "SELECT * FROM addresses WHERE id=? AND user_id=? AND is_active=1",
      addressId,
      req.user.id,
    );
    if (!address) notFound();
    sourceId = source.id;
    sourceVersion = source.version;
  } else {
    source = await orders.find(req.db, publicId, req.user.id);
    if (source.payment_status === "APPROVED")
      fail(409, "ORDER_ALREADY_PAID", "El pedido ya está confirmado.");
    const [lines, products] = await Promise.all([
      req.db.all(
        "SELECT * FROM order_items WHERE order_id=? ORDER BY product_id",
        source.id,
      ),
      catalogIndex(req.db),
    ]);
    const map = new Map(products.map((p) => [p.id, p]));
    items = lines.map((l) => {
      const p = map.get(l.product_id);
      if (p.effective_price_cents !== l.unit_price_cents)
        fail(
          409,
          "NEW_CHECKOUT_REQUIRED",
          "El precio cambió. Revisa una nueva compra en el carrito.",
        );
      return {
        product_id: p.id,
        sku: l.sku_snapshot,
        name: l.name_snapshot,
        quantity: l.quantity,
        unit_price_cents: l.unit_price_cents,
        line_total_cents: l.line_total_cents,
        available: p.is_available && p.quantity >= l.quantity,
        product_version: p.version,
        inventory_version: p.inventory_version,
        promotion: p.promotion,
      };
    });
    address = Object.fromEntries(
      [
        "recipient",
        "phone",
        "region",
        "province",
        "district",
        "street",
        "reference",
      ].map((k) => [k, source[k + "_snapshot"]]),
    );
    sourceId = source.public_id;
    sourceVersion = source.version;
  }
  if (items.some((i) => !i.available))
    fail(
      409,
      "OUT_OF_STOCK",
      "Algunos productos ya no tienen la disponibilidad solicitada.",
    );
  const amount = total(items),
    snap = {
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
    scope,
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
export async function quote(req, scope, addressId, publicId) {
  const s = await summary(req, scope, addressId, publicId);
  return {
    quoteToken: signQuote(
      {
        userId: req.user.id,
        scope,
        sourceId: s.sourceId,
        sourceVersion: s.sourceVersion,
        addressId: addressId || null,
        fingerprint: s.fingerprint,
      },
      req.config.quoteSecret,
    ),
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
export async function pay(req, publicId) {
  const db = req.db,
    key = req.get("Idempotency-Key"),
    operation = publicId ? "pay-order:" + publicId : "create-order";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      key || "",
    )
  )
    fail(422, "VALIDATION", "Se requiere una clave UUID de operación.");
  const requestHash = fingerprint({
    quoteToken: req.body.quoteToken,
    simulationOutcome: req.body.simulationOutcome,
  });
  const replay = async () => {
    const old = await db.first(
      "SELECT * FROM idempotency_records WHERE user_id=? AND operation=? AND key=?",
      req.user.id,
      operation,
      key,
    );
    if (!old) return null;
    if (old.request_hash !== requestHash)
      fail(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Esta clave corresponde a otra operación.",
      );
    return JSON.parse(old.response_json);
  };
  const prior = await replay();
  if (prior) return prior;
  const q = readQuote(req.body.quoteToken, req.config.quoteSecret),
    scope = publicId ? "ORDER" : "CART";
  if (
    q.userId !== req.user.id ||
    q.scope !== scope ||
    (publicId && q.sourceId !== publicId)
  )
    fail(409, "QUOTE_CHANGED", "El resumen no corresponde a esta operación.");
  if (
    !publicId &&
    (await db.first("SELECT id FROM orders WHERE creation_nonce=?", q.nonce))
  )
    fail(
      409,
      "DUPLICATE_CHECKOUT",
      "Este resumen ya registró un pedido. Revisa tu historial.",
    );
  const s = await summary(req, scope, q.addressId, publicId);
  if (s.fingerprint !== q.fingerprint || s.sourceVersion !== q.sourceVersion)
    fail(
      409,
      "QUOTE_CHANGED",
      "El precio, stock o resumen cambió. Revísalo nuevamente.",
    );
  const approved = req.body.simulationOutcome === "APPROVED",
    outcome = approved ? "APPROVED" : "REJECTED",
    date = new Date().toISOString(),
    oid = publicId || randomUUID(),
    a = s.address;
  const lines = JSON.stringify(
    s.items.map((i) => ({
      ...i,
      promo_id: i.promotion?.id || 0,
      promo_version: i.promotion?.version || 0,
    })),
  );
  let condition = `(julianday('now')-2440587.5)*86400000<=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN catalog_products p ON p.id=json_extract(j.value,'$.product_id') WHERE p.id IS NULL OR p.is_active!=1 OR p.category_active!=1 OR p.version!=json_extract(j.value,'$.product_version') OR p.inventory_version!=json_extract(j.value,'$.inventory_version') OR p.effective_price_cents!=json_extract(j.value,'$.unit_price_cents') OR p.quantity<json_extract(j.value,'$.quantity') OR COALESCE(p.promotion_id,0)!=json_extract(j.value,'$.promo_id') OR COALESCE(p.promotion_version,0)!=json_extract(j.value,'$.promo_version'))`;
  const values = [q.expiresAt, lines];
  if (scope === "CART") {
    condition +=
      " AND EXISTS(SELECT 1 FROM carts WHERE id=? AND user_id=? AND version=?) AND EXISTS(SELECT 1 FROM addresses WHERE id=? AND user_id=? AND is_active=1 AND version=?)";
    values.push(
      s.source.id,
      req.user.id,
      s.sourceVersion,
      a.id,
      req.user.id,
      a.version,
    );
  } else {
    condition +=
      " AND EXISTS(SELECT 1 FROM orders WHERE public_id=? AND user_id=? AND version=? AND status='AWAITING_PAYMENT' AND payment_status='REJECTED')";
    values.push(publicId, req.user.id, s.sourceVersion);
  }
  const g = guard(db, req, "CHECKOUT", condition, values, {
      lines: JSON.parse(lines),
    }),
    stmts = [
      g.statement,
      db.stmt(
        "INSERT INTO idempotency_records(user_id,operation,key,request_hash,response_status,response_json,created_at) VALUES(?,?,?,?,201,'{}',?)",
        req.user.id,
        operation,
        key,
        requestHash,
        date,
      ),
    ];
  if (scope === "CART") {
    stmts.push(
      db.stmt(
        "INSERT INTO orders(public_id,creation_nonce,user_id,status,payment_status,subtotal_cents,total_cents,recipient_snapshot,phone_snapshot,region_snapshot,province_snapshot,district_snapshot,street_snapshot,reference_snapshot,source_cart_id,source_cart_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        oid,
        q.nonce,
        req.user.id,
        approved ? "CONFIRMED" : "AWAITING_PAYMENT",
        outcome,
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
      ),
    );
    stmts.push(
      db.stmt(
        "INSERT INTO order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_price_cents,quantity,line_total_cents,promotion_snapshot) SELECT o.id,p.id,p.sku,p.name,json_extract(j.value,'$.unit_price_cents'),json_extract(j.value,'$.quantity'),json_extract(j.value,'$.line_total_cents'),CASE WHEN json_type(j.value,'$.promotion')='null' THEN NULL ELSE json_extract(j.value,'$.promotion') END FROM orders o,json_each(?) j JOIN products p ON p.id=json_extract(j.value,'$.product_id') WHERE o.public_id=?",
        lines,
        oid,
      ),
    );
  } else
    stmts.push(
      db.stmt(
        "UPDATE orders SET status=?,payment_status=?,version=version+1,updated_at=? WHERE public_id=?",
        approved ? "CONFIRMED" : "AWAITING_PAYMENT",
        outcome,
        date,
        oid,
      ),
    );
  if (scope === "CART" || approved)
    stmts.push(
      db.stmt(
        "INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id,created_at) SELECT id,?,?,?,? FROM orders WHERE public_id=?",
        scope === "CART" ? null : "AWAITING_PAYMENT",
        approved ? "CONFIRMED" : "AWAITING_PAYMENT",
        req.user.id,
        date,
        oid,
      ),
    );
  stmts.push(
    db.stmt(
      "INSERT INTO simulated_payments(order_id,outcome,amount_cents,currency,created_at) SELECT id,?,total_cents,'PEN',? FROM orders WHERE public_id=?",
      outcome,
      date,
      oid,
    ),
  );
  if (approved) {
    stmts.push(
      db.stmt(
        "UPDATE inventory SET quantity=quantity-(SELECT quantity FROM order_items WHERE order_id=(SELECT id FROM orders WHERE public_id=?) AND product_id=inventory.product_id),version=version+1,updated_at=? WHERE product_id IN(SELECT product_id FROM order_items WHERE order_id=(SELECT id FROM orders WHERE public_id=?))",
        oid,
        date,
        oid,
      ),
    );
    stmts.push(
      db.stmt(
        "INSERT INTO inventory_movements(product_id,order_id,actor_user_id,kind,delta,quantity_after,reason,created_at) SELECT oi.product_id,oi.order_id,?,'SALE',-oi.quantity,i.quantity,'Compra con pago simulado aprobado',? FROM order_items oi JOIN inventory i ON i.product_id=oi.product_id JOIN orders o ON o.id=oi.order_id WHERE o.public_id=?",
        req.user.id,
        date,
        oid,
      ),
    );
    const matching =
      "SELECT c.id FROM carts c JOIN orders o ON o.source_cart_id=c.id WHERE o.public_id=? AND c.version=o.source_cart_version";
    stmts.push(
      db.stmt(`DELETE FROM cart_items WHERE cart_id IN(${matching})`, oid),
      db.stmt(
        `UPDATE carts SET version=version+1,updated_at=? WHERE id IN(${matching})`,
        date,
        oid,
      ),
    );
  }
  stmts.push(
    db.stmt(
      "UPDATE idempotency_records SET response_json=(SELECT document FROM order_documents WHERE public_id=?) WHERE user_id=? AND operation=? AND key=?",
      oid,
      req.user.id,
      operation,
      key,
    ),
    db.stmt("DELETE FROM mutation_contexts WHERE operation_id=?", g.id),
    db.stmt(
      "SELECT response_json FROM idempotency_records WHERE user_id=? AND operation=? AND key=?",
      req.user.id,
      operation,
      key,
    ),
  );
  try {
    const result = await db.batch(stmts);
    return JSON.parse(result.at(-1).results[0].response_json);
  } catch (error) {
    const saved = await replay();
    if (saved) return saved;
    throw error;
  }
}
