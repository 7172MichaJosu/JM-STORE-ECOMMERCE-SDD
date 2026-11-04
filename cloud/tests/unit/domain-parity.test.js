import { test, expect } from "vitest";
import {
  discounted,
  total,
  integer,
  orderStates,
} from "../../../shared/domain/index.js";
test("reglas compartidas mantienen resultados y límites de dinero/estados", () => {
  expect(discounted(1990, 2500)).toBe(1493);
  expect(discounted(89900, 5000)).toBe(44950);
  const items = [
    { unit_price_cents: 89900, quantity: 2 },
    { unit_price_cents: 14900, quantity: 3 },
  ];
  expect(total(items)).toBe(224500);
  expect(() => integer(1.5, "stock")).toThrow();
  expect(orderStates.at(-1)).toBe("DELIVERED");
});
