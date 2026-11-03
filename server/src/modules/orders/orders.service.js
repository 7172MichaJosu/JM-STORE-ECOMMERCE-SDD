import { notFound } from "../../lib/errors.js";
export function orderByPublic(db, id, userId) {
  const row = userId
    ? db
        .prepare("SELECT * FROM orders WHERE public_id=? AND user_id=?")
        .get(id, userId)
    : db.prepare("SELECT * FROM orders WHERE public_id=?").get(id);
  if (!row) notFound();
  return row;
}
export function orderView(db, o) {
  return {
    publicId: o.public_id,
    status: o.status,
    paymentStatus: o.payment_status,
    subtotal_cents: o.subtotal_cents,
    total_cents: o.total_cents,
    currency: o.currency,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    version: o.version,
    simulationOnly: true,
    customer: db
      .prepare("SELECT id,name,email FROM users WHERE id=?")
      .get(o.user_id),
    deliveryAddress: {
      recipient: o.recipient_snapshot,
      phone: o.phone_snapshot,
      region: o.region_snapshot,
      province: o.province_snapshot,
      district: o.district_snapshot,
      street: o.street_snapshot,
      reference: o.reference_snapshot,
    },
    items: db
      .prepare(
        "SELECT product_id,sku_snapshot,name_snapshot name,unit_price_cents,quantity,line_total_cents FROM order_items WHERE order_id=?",
      )
      .all(o.id),
    payments: db
      .prepare(
        "SELECT id,outcome,amount_cents,currency,created_at createdAt FROM simulated_payments WHERE order_id=? ORDER BY id",
      )
      .all(o.id),
    history: db
      .prepare(
        "SELECT from_status fromStatus,to_status toStatus,created_at createdAt FROM order_status_history WHERE order_id=? ORDER BY id",
      )
      .all(o.id),
  };
}
