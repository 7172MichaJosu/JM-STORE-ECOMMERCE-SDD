import { existsSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import { configuration, root } from "../src/config.js";
import { backup, assertStopped } from "./backup.js";
import { openDatabase } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/modules/catalog/seed-data.js";
export function resetDemo(
  databasePath,
  allowedDirectory = path.join(root, "server/data"),
) {
  const allowed = realpathSync(allowedDirectory),
    target = realpathSync(databasePath),
    relative = path.relative(allowed, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative)
    throw Error("Ruta fuera del directorio permitido.");
  assertStopped(target);
  const saved = backup(target);
  for (const suffix of ["", "-wal", "-shm"])
    if (existsSync(target + suffix)) rmSync(target + suffix);
  const db = openDatabase(target);
  try {
    migrate(db);
    seed(db);
  } finally {
    db.close();
  }
  return saved;
}
if (process.argv[1] === import.meta.filename) {
  if (process.argv[process.argv.indexOf("--confirm") + 1] !== "JM-STORE-DEMO")
    throw Error("Requiere --confirm JM-STORE-DEMO y API detenida.");
  console.log("Respaldo previo:", resetDemo(configuration().databasePath));
  console.log(
    "Demo reconstruida; provisiona nuevamente un administrador privado.",
  );
}
