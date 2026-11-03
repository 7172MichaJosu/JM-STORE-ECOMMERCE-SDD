import test from "node:test";
import assert from "node:assert/strict";
import { total, discounted } from "../../src/lib/money.js";
test("dinero entero, mitad arriba y límite de seguridad", () => {
  assert.equal(discounted(199, 5000), 100);
  assert.equal(total([{ quantity: 2, unit_price_cents: 14990 }]), 29980);
  assert.throws(() =>
    total([{ quantity: 99, unit_price_cents: Number.MAX_SAFE_INTEGER }]),
  );
});
