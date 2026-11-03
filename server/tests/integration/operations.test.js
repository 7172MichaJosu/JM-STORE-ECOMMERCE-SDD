import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../../src/db/connection.js";
import { migrate } from "../../src/db/migrate.js";
import { seed } from "../../src/modules/catalog/seed-data.js";
import { backup } from "../../scripts/backup.js";
import { resetDemo } from "../../scripts/reset-demo.js";
test("respaldo, restauración legible y reset aislado con guardas de ruta/proceso", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "jm-ops-")),
    file = path.join(dir, "test.sqlite");
  try {
    let db = openDatabase(file);
    migrate(db);
    seed(db);
    db.prepare("UPDATE inventory SET quantity=2 WHERE product_id=1").run();
    db.close();
    writeFileSync(file + ".lock", String(process.pid));
    assert.throws(() => backup(file), /Detén/);
    rmSync(file + ".lock");
    const dest = backup(file),
      saved = openDatabase(path.join(dest, "jm-store.sqlite"));
    assert.equal(
      saved.prepare("SELECT quantity FROM inventory WHERE product_id=1").get()
        .quantity,
      2,
    );
    saved.close();
    assert.throws(() => resetDemo(file, path.join(dir, "missing")));
    resetDemo(file, dir);
    db = openDatabase(file);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM products").get().n, 20);
    assert.equal(
      db.prepare("SELECT quantity FROM inventory WHERE product_id=1").get()
        .quantity,
      18,
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test("provisionar admin privado una vez sin promover cuenta existente", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "jm-admin-")),
    file = path.join(dir, "test.sqlite"),
    password = randomUUID();
  try {
    const env = {
      ...process.env,
      DATABASE_PATH: file,
      QUOTE_SECRET: randomUUID(),
      ADMIN_EMAIL: "private-admin@example.test",
      ADMIN_PASSWORD: password,
    };
    const output = execFileSync(
      process.execPath,
      ["server/scripts/provision-admin.js"],
      { env, encoding: "utf8" },
    );
    assert.ok(!output.includes(password));
    assert.throws(() =>
      execFileSync(process.execPath, ["server/scripts/provision-admin.js"], {
        env,
        stdio: "pipe",
      }),
    );
    const db = openDatabase(file);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) n FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='ADMIN'",
        )
        .get().n,
      1,
    );
    assert.ok(
      db
        .prepare("SELECT password_hash FROM users")
        .get()
        .password_hash.startsWith("scrypt$"),
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
