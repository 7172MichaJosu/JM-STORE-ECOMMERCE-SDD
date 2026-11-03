import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transaction } from "./connection.js";
export function migrate(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
  );
  const dir = fileURLToPath(new URL("../../migrations/", import.meta.url));
  let files = [];
  try {
    files = readdirSync(dir)
      .filter((x) => x.endsWith(".sql"))
      .sort();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  for (const file of files) {
    if (
      !db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(file)
    )
      transaction(db, () => {
        db.exec(readFileSync(dir + file, "utf8"));
        db.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(
          file,
          new Date().toISOString(),
        );
      });
  }
}
