import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
const root = path.resolve(import.meta.dirname, "../.."),
  env = path.join(root, ".env.local");
if (!existsSync(env))
  writeFileSync(
    env,
    `NODE_ENV=production\nHOST=127.0.0.1\nPORT=3001\nAPP_ORIGIN=http://localhost:3001\nDATABASE_PATH=server/data/jm-store.sqlite\nQUOTE_SECRET=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
const { configuration } = await import("../src/config.js");
const { openDatabase } = await import("../src/db/connection.js");
const { migrate } = await import("../src/db/migrate.js");
const { seed } = await import("../src/modules/catalog/seed-data.js");
const { hashPassword } = await import("../src/lib/passwords.js");
const db = openDatabase(configuration().databasePath);
migrate(db);
seed(db);
if (
  !db
    .prepare(
      "SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='ADMIN'",
    )
    .get()
) {
  const email = "admin-" + randomBytes(3).toString("hex") + "@jm-store.local",
    password = randomBytes(24).toString("base64url"),
    date = new Date().toISOString();
  db.prepare(
    "INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='ADMIN'),?,'Administrador JM',?,?,?)",
  ).run(email, await hashPassword(password), date, date);
  mkdirSync(path.join(root, "server/data"), { recursive: true });
  writeFileSync(
    path.join(root, "server/data/admin-access.txt"),
    `Acceso local privado JM-STORE\nCorreo: ${email}\nContraseña: ${password}\n\nURL: http://localhost:3001/admin/ingresar\nNo publicar ni compartir este archivo.\n`,
    { mode: 0o600 },
  );
}
db.close();
console.log(
  "Demostración preparada. Credenciales privadas: server/data/admin-access.txt (si se creó admin).",
);
