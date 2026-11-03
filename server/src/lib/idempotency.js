import { fingerprint } from "./quotes.js";
import { fail } from "./errors.js";
export function idempotency(db, userId, operation, key, body, work) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      key || "",
    )
  )
    fail(422, "VALIDATION", "Se requiere una clave UUID de operación.");
  const hash = fingerprint({
    quoteToken: body.quoteToken,
    simulationOutcome: body.simulationOutcome,
  });
  const old = db
    .prepare(
      "SELECT * FROM idempotency_records WHERE user_id=? AND operation=? AND key=?",
    )
    .get(userId, operation, key);
  if (old) {
    if (old.request_hash !== hash)
      fail(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Esta clave corresponde a otra operación.",
      );
    return JSON.parse(old.response_json);
  }
  const result = work();
  db.prepare(
    "INSERT INTO idempotency_records(user_id,operation,key,request_hash,response_status,response_json,created_at) VALUES(?,?,?,?,201,?,?)",
  ).run(
    userId,
    operation,
    key,
    hash,
    JSON.stringify(result),
    new Date().toISOString(),
  );
  return result;
}
