import { Router } from "express";
import { imageLibrary, saveImages } from "./image-library.js";
import { product } from "../catalog/catalog.service.js";
import { fields, version } from "../../lib/validation.js";
import { transaction } from "../../db/connection.js";
export function imagesRoutes(db) {
  const r = Router();
  r.get("/image-library", (q, s) => s.json({ data: imageLibrary() }));
  r.put("/products/:id/images", (req, res) => {
    fields(req.body, ["version", "images"]);
    const p = product(db, req.params.id, true);
    version(req.body.version, p.version);
    transaction(db, () => {
      saveImages(db, p.id, req.body.images);
      db.prepare("UPDATE products SET version=version+1 WHERE id=?").run(p.id);
    });
    res.json({ data: product(db, p.id, true) });
  });
  return r;
}
