import { randomUUID } from "node:crypto";
export function authorization(req) {
  return {
    sql: `EXISTS(SELECT 1 FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.namespace=? AND s.expires_at>? AND ((s.user_id IS NULL AND ? IS NULL) OR (s.user_id=? AND u.is_active=1 AND u.auth_version=? AND s.auth_version=u.auth_version AND unixepoch(s.last_seen_at)>unixepoch('now')-1800)))`,
    values: [
      req.session?.id || 0,
      req.config.namespace,
      new Date().toISOString(),
      req.user?.id || null,
      req.user?.id || null,
      req.authVersion,
    ],
  };
}
export function guard(
  db,
  req,
  kind,
  condition = "1",
  values = [],
  payload = {},
  id = randomUUID(),
) {
  const a = authorization(req);
  return {
    id,
    statement: db.stmt(
      `INSERT INTO mutation_contexts(operation_id,user_id,kind,payload_json,created_at,ok) SELECT ?,?,?,?,?,CASE WHEN ${a.sql} AND (${condition}) THEN 1 ELSE 0 END`,
      id,
      req.user?.id || null,
      kind,
      JSON.stringify(payload),
      new Date().toISOString(),
      ...a.values,
      ...values,
    ),
  };
}
export async function mutate(req, kind, condition, values, statements) {
  const g = guard(req.db, req, kind, condition, values);
  return req.db.batch([
    g.statement,
    ...statements,
    req.db.stmt("DELETE FROM mutation_contexts WHERE operation_id=?", g.id),
  ]);
}
