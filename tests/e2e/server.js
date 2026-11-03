import { createApp } from "../../server/src/app.js";
import { seed } from "../../server/src/modules/catalog/seed-data.js";
import { hashPassword } from "../../server/src/lib/passwords.js";
import { randomUUID } from "node:crypto";
const ctx = createApp({
  databasePath: process.env.E2E_DATABASE,
  quoteSecret: randomUUID(),
  origin: "http://localhost:3101",
  testing: true,
});
seed(ctx.db);
const date = new Date().toISOString();
ctx.db
  .prepare(
    "INSERT INTO users(role_id,email,name,password_hash,created_at,updated_at) VALUES((SELECT id FROM roles WHERE code='ADMIN'),?,'Admin examen',?,?,?)",
  )
  .run(
    process.env.TEST_ADMIN_EMAIL,
    await hashPassword(process.env.TEST_ADMIN_PASSWORD),
    date,
    date,
  );
ctx.finish();
const server = ctx.app.listen(3101, "localhost");
process.on("SIGTERM", () =>
  server.close(() => {
    ctx.close();
    process.exit();
  }),
);
