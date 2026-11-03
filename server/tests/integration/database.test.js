import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../src/db/connection.js";
import { migrate } from "../../src/db/migrate.js";
test("SQLite persiste, FK activas y migraciones repetibles", () => {
  const dir = mkdtempSync(join(tmpdir(), "jm-db-"));
  const p = join(dir, "test.sqlite");
  let db = openDatabase(p);
  migrate(db);
  const n = db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n;
  migrate(db);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,
    n,
  );
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
  db.close();
  db = openDatabase(p);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,
    n,
  );
  db.close();
  rmSync(dir, { recursive: true });
});
