import { text, integer, flag } from "../../lib/validation.js";
import { fail, notFound } from "../../lib/errors.js";
export function productInput(db, b) {
  const categoryId = integer(b.categoryId, "categoryId", 1);
  const c = db.prepare("SELECT * FROM categories WHERE id=?").get(categoryId);
  if (!c) notFound();
  const isActive = flag(b.isActive, "isActive");
  if (isActive && !c.is_active)
    fail(422, "VALIDATION", "Activa la categoría antes de publicar.");
  const slug = text(b.slug, "slug", 1, 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    fail(
      422,
      "VALIDATION",
      "El slug admite letras minúsculas, números y guiones.",
    );
  return [
    categoryId,
    text(b.sku, "sku", 1, 64),
    slug,
    text(b.name, "name", 2, 120),
    text(b.description, "description", 1, 4000),
    integer(b.basePriceCents, "basePriceCents", 1, 100000000),
    isActive,
    flag(b.isFeatured, "isFeatured"),
  ];
}
