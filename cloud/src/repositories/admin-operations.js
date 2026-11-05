import { fields, version, integer, text, flag, fail, notFound } from "../../../shared/domain/index.js";
import { adminMutation, id, row } from "./admin-common.js";
export const customerSelect = "SELECT u.id,u.name,u.email,u.phone,u.is_active,u.version,u.created_at FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='CUSTOMER'";
export async function customer(req) {
  const found = await req.db.first(customerSelect + " AND u.id=?", id(req.params.id));
  if (!found) notFound(); return found;
}
export async function changeCustomer(req) {
  fields(req.body, ["version", "name", "phone", "isActive"]);
  const u = await customer(req); version(req.body.version, u.version);
  const name = text(req.body.name ?? u.name, "name", 2, 100), phone = req.body.phone === undefined ? u.phone : req.body.phone ? text(req.body.phone, "phone", 7, 20) : null, active = req.body.isActive === undefined ? u.is_active : flag(req.body.isActive, "isActive");
  await adminMutation(req, "ADMIN_CUSTOMER", "EXISTS(SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND u.version=? AND r.code='CUSTOMER')", [u.id, u.version], [req.db.stmt("UPDATE users SET name=?,phone=?,is_active=?,version=version+1,auth_version=auth_version+?,updated_at=? WHERE id=?", name, phone, active, active ? 0 : 1, new Date().toISOString(), u.id), ...(active ? [] : [req.db.stmt("DELETE FROM sessions WHERE user_id=?", u.id)])]);
  return customer(req);
}
export async function adjustInventory(req) {
  fields(req.body, ["expectedVersion", "newQuantity", "reason"]);
  const i = await req.db.first("SELECT * FROM inventory WHERE product_id=?", id(req.params.id)); if (!i) notFound();
  version(req.body.expectedVersion, i.version);
  const qty = integer(req.body.newQuantity, "newQuantity", 0, 1000000), reason = text(req.body.reason, "reason", 3, 200), date = new Date().toISOString();
  if (qty === i.quantity) fail(422, "VALIDATION", "Indica una cantidad diferente.");
  const result = await adminMutation(req, "ADMIN_INVENTORY", "EXISTS(SELECT 1 FROM inventory WHERE product_id=? AND version=? AND quantity=?)", [i.product_id, i.version, i.quantity], [req.db.stmt("UPDATE inventory SET quantity=?,version=version+1,updated_at=? WHERE product_id=?", qty, date, i.product_id), req.db.stmt("INSERT INTO inventory_movements(product_id,actor_user_id,kind,delta,quantity_after,reason,created_at) VALUES(?,?,'ADJUSTMENT',?,?,?,?) RETURNING *", i.product_id, req.user.id, qty - i.quantity, qty, reason, date)]);
  return result[2].results[0];
}
export async function orderDocument(req) {
  const data = await req.db.first("SELECT document FROM order_documents WHERE public_id=?", req.params.id);
  if (!data) notFound(); return JSON.parse(data.document);
}
export async function changeOrder(req) {
  fields(req.body, ["expectedVersion", "status"]);
  const o = await req.db.first("SELECT * FROM orders WHERE public_id=?", req.params.id); if (!o) notFound();
  version(req.body.expectedVersion, o.version);
  const next = { CONFIRMED: "PREPARING", PREPARING: "SHIPPED", SHIPPED: "DELIVERED" }[o.status];
  if (!next || req.body.status !== next) fail(409, "INVALID_TRANSITION", "El cambio de estado no está permitido.");
  const date = new Date().toISOString();
  await adminMutation(req, "ADMIN_ORDER", "EXISTS(SELECT 1 FROM orders WHERE id=? AND version=? AND status=? AND payment_status='APPROVED')", [o.id, o.version, o.status], [req.db.stmt("UPDATE orders SET status=?,version=version+1,updated_at=? WHERE id=?", next, date, o.id), req.db.stmt("INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id,created_at) VALUES(?,?,?,?,?)", o.id, o.status, next, req.user.id, date)]);
  return orderDocument(req);
}
