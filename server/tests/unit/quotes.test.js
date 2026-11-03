import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { signQuote, readQuote } from "../../src/lib/quotes.js";
import { hashPassword, verifyPassword } from "../../src/lib/passwords.js";
test("cotización firmada rechaza alteración y otro secreto", () => {
  const secret = randomUUID(),
    token = signQuote({ userId: 1, scope: "CART", sourceId: 2 }, secret);
  assert.equal(readQuote(token, secret).userId, 1);
  assert.throws(() => readQuote(token + "0", secret));
  assert.throws(() => readQuote(token, randomUUID()));
});
test("scrypt sal distinta y verificación de contraseña", async () => {
  const password = randomUUID(),
    a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword(password + "x", a), false);
});
