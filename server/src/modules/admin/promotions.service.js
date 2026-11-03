import { text, integer, flag } from "../../lib/validation.js";
import { fail } from "../../lib/errors.js";
import { discounted } from "../../lib/money.js";
export function promotionInput(db, b, id = 0) {
  const p = b.productId || null,
    c = b.categoryId || null;
  if (Number(!!p) + Number(!!c) !== 1)
    fail(422, "VALIDATION", "Elige un solo producto o categoría.");
  if (p) integer(p, "productId", 1);
  if (c) integer(c, "categoryId", 1);
  if (
    !["FINAL_PRICE", "PERCENT_BPS"].includes(b.kind) ||
    (p && b.kind !== "FINAL_PRICE") ||
    (c && b.kind !== "PERCENT_BPS")
  )
    fail(422, "VALIDATION", "Regla no válida para este objetivo.");
  const value = integer(b.value, "value", 1, c ? 9999 : 100000000);
  const start = new Date(text(b.startsAt, "startsAt", 1, 50)),
    end = new Date(text(b.endsAt, "endsAt", 1, 50));
  if (
    !/T.+(Z|[+-]\d\d:\d\d)$/.test(b.startsAt) ||
    !/T.+(Z|[+-]\d\d:\d\d)$/.test(b.endsAt) ||
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +start >= +end
  )
    fail(
      422,
      "VALIDATION",
      "Define fechas válidas con zona y fin posterior al inicio.",
    );
  const isActive = flag(b.isActive, "isActive");
  const target = p
    ? db.prepare("SELECT base_price_cents FROM products WHERE id=?").get(p)
    : db.prepare("SELECT id FROM categories WHERE id=?").get(c);
  if (!target) fail(422, "VALIDATION", "Objetivo no disponible.");
  if (p && value >= target.base_price_cents)
    fail(
      422,
      "VALIDATION",
      "El precio promocional debe ser menor al precio base.",
    );
  if (
    c &&
    db
      .prepare("SELECT base_price_cents FROM products WHERE category_id=?")
      .all(c)
      .some((x) => discounted(x.base_price_cents, value) < 1)
  )
    fail(422, "VALIDATION", "La regla produciría un precio cero.");
  const starts = start.toISOString(),
    ends = end.toISOString();
  if (
    isActive &&
    db
      .prepare(
        "SELECT 1 FROM promotions WHERE id!=? AND is_active=1 AND (product_id=? OR category_id=?) AND starts_at<? AND ends_at>?",
      )
      .get(id, p, c, ends, starts)
  )
    fail(
      409,
      "PROMOTION_OVERLAP",
      "Ya existe una promoción para ese objetivo y período.",
    );
  return [
    p,
    c,
    b.kind,
    value,
    starts,
    ends,
    text(b.terms, "terms", 1, 500),
    isActive,
  ];
}
