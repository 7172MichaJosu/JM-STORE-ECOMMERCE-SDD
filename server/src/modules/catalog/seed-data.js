import { transaction } from "../../db/connection.js";
export const categories = [
  ["Tecnología", "tecnologia"],
  ["Hogar", "hogar"],
  ["Accesorios", "accesorios"],
  ["Cuidado personal", "cuidado-personal"],
  ["Deportes", "deportes"],
];
export const demoProducts = [
  ["Portátil de estudio 15.6”", 1, 189900, "laptop", 18],
  ["Auriculares inalámbricos", 1, 14900, "headphones", 24],
  ["Teclado compacto", 1, 15900, "keyboard", 16],
  ["Monitor de escritorio 24”", 1, 64900, "monitor-jm.png", 12],
  ["Cámara instantánea", 1, 34900, "camera-jm.png", 8],
  ["Lámpara de pie", 2, 7990, "lamp", 20],
  ["Silla acolchada", 2, 59900, "chair", 6],
  ["Escritorio de estudio", 2, 3990, "desk", 18],
  ["Taza de cerámica", 2, 2490, "mug", 35],
  ["Kit de jardinería", 2, 4590, "plant", 22],
  ["Mochila urbana", 3, 12900, "backpack", 15],
  ["Reloj de diseño minimalista", 3, 19900, "watch-jm.png", 10],
  ["Lentes de sol", 3, 6990, "sunglasses", 14],
  ["Mochila compacta diaria", 3, 8990, "bag", 0],
  ["Set de cuidado facial", 4, 7990, "skincare-jm.png", 26],
  ["Jabón artesanal", 4, 1990, "soap", 30],
  ["Crema de manos", 4, 2990, "skincare-jm.png", 17],
  ["Zapatillas deportivas", 5, 16900, "shoes-jm.png", 19],
  ["Botella deportiva", 5, 4990, "bottle", 27],
  ["Accesorios de entrenamiento", 5, 5990, "fitness", 12],
];
export function seed(db) {
  transaction(db, () => {
    for (const [name, slug] of categories)
      db.prepare("INSERT OR IGNORE INTO categories(name,slug) VALUES(?,?)").run(
        name,
        slug,
      );
    demoProducts.forEach(([name, category, price, image, stock], i) => {
      const sku = `JM-${String(i + 1).padStart(3, "0")}`;
      if (db.prepare("SELECT 1 FROM products WHERE sku=?").get(sku)) return;
      const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, "");
      const r = db
        .prepare(
          "INSERT INTO products(category_id,sku,slug,name,description,base_price_cents,is_featured) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          category,
          sku,
          slug,
          name,
          `${name}. Una selección para tu día a día. Producto de demostración JM-STORE; fotografía referencial genérica. Consulta su disponibilidad antes de confirmar.`,
          price,
          Number(i < 8),
        );
      const id = Number(r.lastInsertRowid);
      db.prepare(
        "INSERT INTO inventory(product_id,quantity,updated_at) VALUES(?,?,?)",
      ).run(id, stock, new Date().toISOString());
      db.prepare(
        "INSERT INTO product_images(product_id,asset_path,alt_text,position) VALUES(?,?,?,0)",
      ).run(
        id,
        `/images/demo/${image.includes(".") ? image : image + ".jpg"}`,
        name,
      );
      db.prepare(
        "INSERT INTO inventory_movements(product_id,kind,delta,quantity_after,reason,created_at) VALUES(?,'SEED',?,?,?,?)",
      ).run(
        id,
        stock,
        stock,
        "Inventario inicial de demostración",
        new Date().toISOString(),
      );
    });
    if (!db.prepare("SELECT 1 FROM promotions").get())
      db.prepare(
        "INSERT INTO promotions(product_id,kind,value,starts_at,ends_at,terms) VALUES(1,'FINAL_PRICE',169900,'2026-01-01T00:00:00.000Z','2027-12-31T00:00:00.000Z','Precio promocional de demostración. Sujeto al stock disponible.')",
      ).run();
  });
}
