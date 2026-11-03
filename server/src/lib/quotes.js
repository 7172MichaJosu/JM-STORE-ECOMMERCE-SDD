import {
  createHmac,
  createHash,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { fail } from "./errors.js";
export const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function signQuote(payload, secret) {
  const raw = Buffer.from(
    JSON.stringify({
      ...payload,
      nonce: randomUUID(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    }),
  ).toString("base64url");
  return (
    raw + "." + createHmac("sha256", secret).update(raw).digest("base64url")
  );
}
export function readQuote(token, secret) {
  try {
    const [raw, sig, ...rest] = token.split(".");
    const expected = createHmac("sha256", secret).update(raw).digest();
    const actual = Buffer.from(sig || "", "base64url");
    if (
      rest.length ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw Error();
    const q = JSON.parse(Buffer.from(raw, "base64url"));
    if (q.expiresAt < Date.now())
      fail(409, "QUOTE_EXPIRED", "El resumen venció. Revísalo nuevamente.");
    return q;
  } catch (e) {
    if (e.status) throw e;
    fail(409, "QUOTE_CHANGED", "El resumen no es válido. Solicita uno nuevo.");
  }
}
