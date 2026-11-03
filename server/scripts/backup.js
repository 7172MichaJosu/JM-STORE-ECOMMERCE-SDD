import { existsSync, readFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { configuration, root } from "../src/config.js";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
export function assertStopped(databasePath) {
  const lock = databasePath + ".lock";
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    try {
      process.kill(pid, 0);
    } catch (e) {
      if (e.code === "ESRCH") return;
      throw e;
    }
    throw Error("Detén la API antes de respaldar o resetear.");
  }
}
export function backup(databasePath) {
  assertStopped(databasePath);
  if (!existsSync(databasePath))
    throw Error("No existe una base para respaldar.");
  const check = new DatabaseSync(databasePath, { readOnly: true });
  try {
    if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error(
        "La integridad de la base debe revisarse antes del respaldo.",
      );
  } finally {
    check.close();
  }
  const dest = path.join(
    root,
    "backups",
    new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      randomUUID().slice(0, 6),
  );
  mkdirSync(dest, { recursive: true });
  for (const suffix of ["", "-wal", "-shm"])
    if (existsSync(databasePath + suffix))
      copyFileSync(
        databasePath + suffix,
        path.join(dest, "jm-store.sqlite" + suffix),
      );
  return dest;
}
if (process.argv[1] === import.meta.filename)
  console.log("Respaldo creado en:", backup(configuration().databasePath));
