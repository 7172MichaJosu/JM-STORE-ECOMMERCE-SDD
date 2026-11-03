import { readdirSync } from "node:fs";
import path from "node:path";
import { root } from "../../config.js";
import { fail } from "../../lib/errors.js";
import { text, integer } from "../../lib/validation.js";
export function imageLibrary() {
  let files = [];
  try {
    files = readdirSync(path.join(root, "client/public/images/demo"));
  } catch {}
  return files
    .filter((x) => /^[a-z0-9-]+\.(jpg|webp|png)$/.test(x))
    .map((x) => ({
      path: "/images/demo/" + x,
      alt: x.replace(/\..+$/, "").replaceAll("-", " "),
    }));
}
export function imageInput(images) {
  if (!Array.isArray(images) || images.length > 4)
    fail(422, "VALIDATION", "Selecciona hasta cuatro imágenes.");
  const allowed = new Set(imageLibrary().map((i) => i.path));
  return images.map((img, index) => {
    if (!allowed.has(img.path))
      fail(422, "VALIDATION", "Usa una imagen de la biblioteca local.");
    return {
      path: img.path,
      alt: text(img.alt, "alt", 1, 200),
      position: integer(img.position ?? index, "position", 0, 3),
    };
  });
}
export function saveImages(db, id, images) {
  const rows = imageInput(images);
  if (new Set(rows.map((i) => i.position)).size !== rows.length)
    fail(422, "VALIDATION", "Las posiciones de imágenes deben ser distintas.");
  db.prepare("DELETE FROM product_images WHERE product_id=?").run(id);
  for (const i of rows)
    db.prepare(
      "INSERT INTO product_images(product_id,asset_path,alt_text,position) VALUES(?,?,?,?)",
    ).run(id, i.path, i.alt, i.position);
}
