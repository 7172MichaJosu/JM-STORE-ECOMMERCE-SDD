export function discounted(base, bps) {
  return Math.floor((base * (10000 - bps) + 5000) / 10000);
}
export function total(items) {
  const n = items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);
  if (!Number.isSafeInteger(n) || n < 0 || n > 990000000000)
    throw new RangeError("Importe fuera de rango");
  return n;
}
