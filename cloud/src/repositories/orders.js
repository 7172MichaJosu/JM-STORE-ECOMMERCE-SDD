import { notFound, pagination, fields } from "../../../shared/domain/index.js";
export async function find(db, publicId, userId) {
  const o = await db.first(
    "SELECT * FROM orders WHERE public_id=? AND user_id=?",
    publicId,
    userId,
  );
  if (!o) notFound();
  return o;
}
export async function view(db, publicId, userId) {
  const o = await db.first(
    "SELECT document FROM order_documents WHERE public_id=? AND user_id=?",
    publicId,
    userId,
  );
  if (!o) notFound();
  return JSON.parse(o.document);
}
export async function list(req) {
  fields(req.query, ["page", "pageSize"]);
  const { page, pageSize } = pagination(req.query);
  const rows = await req.db.all(
      "SELECT document FROM order_documents WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
      req.user.id,
      pageSize,
      (page - 1) * pageSize,
    ),
    n = await req.db.first(
      "SELECT count(*) n FROM orders WHERE user_id=?",
      req.user.id,
    );
  return {
    data: rows.map((x) => JSON.parse(x.document)),
    meta: { page, pageSize, total: n.n },
  };
}
