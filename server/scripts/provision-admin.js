import { configuration } from "../src/config.js";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { hashPassword } from "../src/lib/passwords.js";
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12 || password.length > 128)
  throw Error(
    "Define ADMIN_EMAIL y ADMIN_PASSWORD local (12..128 caracteres).",
  );
const db = openDatabase(configuration().databasePath);
migrate(db);
if (
  db
    .prepare(
      "SELECT 1 FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='ADMIN' OR u.email=?",
    )
    .get(email)
) {
  db.close();
  throw Error(
    "Ya existe administrador o el correo está en uso; no se cambian roles.",
  );
}
const date = new Date().toISOString();
db.prepare(
  "INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='ADMIN'),?,'Administrador JM',?,?,?)",
).run(email, await hashPassword(password), date, date);
db.close();
console.log(
  "Administrador provisionado. Retira ADMIN_PASSWORD del entorno local.",
);
