import { integer, notFound, pagination, text, fail } from "../../../shared/domain/index.js";
import { mutate } from "./mutations.js";
export const id = value => integer(Number(value), "id", 1);
export async function row(db, table, key) {
  const found = await db.first(`SELECT * FROM ${table} WHERE id=?`, id(key));
  if (!found) notFound(); return found;
}
export function slug(value, max = 160) {
  const result = text(value, "slug", 1, max);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) fail(422, "VALIDATION", "Slug no válido.");
  return result;
}
export function page(rows, query) {
  const { page, pageSize } = pagination(query);
  return { data: rows.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: rows.length } };
}
export function adminMutation(req, kind, condition, values, statements) {
  return mutate(req, kind, `EXISTS(SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=? AND r.code='ADMIN') AND (${condition})`, [req.user.id, ...values], statements);
}
