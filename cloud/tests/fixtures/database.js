export async function seedMinimal(db, { quantity = 8, price = 89900 } = {}) {
  const date = "2026-11-04T00:00:00.000Z";
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO roles(id,code) VALUES(1,'CUSTOMER'),(2,'ADMIN')",
    ),
    db
      .prepare(
        "INSERT INTO users(id,role_id,email,name,password_hash,created_at,updated_at) VALUES(1,1,'synthetic@example.test','Usuario sintético','unusable-fixture',?,?)",
      )
      .bind(date, date),
    db.prepare(
      "INSERT INTO categories(id,name,slug) VALUES(1,'Tecnología','tecnologia')",
    ),
    db
      .prepare(
        "INSERT INTO products(id,category_id,sku,slug,name,description,base_price_cents,is_featured) VALUES(1,1,'JM-TEST-1','producto-prueba','Producto de prueba','Datos sintéticos',?,1)",
      )
      .bind(price),
    db.prepare("INSERT INTO inventory VALUES(1,?,1,?)").bind(quantity, date),
    db.prepare(
      "INSERT INTO product_images(product_id,asset_path,alt_text,position) VALUES(1,'/images/demo/monitor-jm.png','Producto referencial',0)",
    ),
    db.prepare(
      "UPDATE deployment_state SET environment_id='staging',database_identity='local-only',mode='OPEN' WHERE id=1",
    ),
  ]);
}
export async function seedOrder(db) {
  await seedMinimal(db);
  await db
    .prepare(
      "INSERT INTO orders(id,public_id,creation_nonce,user_id,status,payment_status,subtotal_cents,total_cents,recipient_snapshot,phone_snapshot,region_snapshot,province_snapshot,district_snapshot,street_snapshot,created_at,updated_at) VALUES(1,'test-order','test-nonce',1,'AWAITING_PAYMENT','REJECTED',500,500,'Usuario','999000111','Lima','Lima','Lima','Calle prueba','now','now')",
    )
    .run();
}
