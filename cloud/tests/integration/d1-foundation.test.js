import { test, expect } from "vitest";
import { env } from "cloudflare:workers";
import { connect } from "../../src/db/connection.js";
import {
  deploymentState,
  selectMigrations,
  migrationFiles,
} from "../../src/db/migrations.js";
test("D1 async usa binding y revierte todo el batch ante fallo SQL", async () => {
  const db = connect(env.DB);
  await expect(
    db.batch([
      db.stmt("INSERT INTO categories(name,slug) VALUES('Atomic','atomic')"),
      db.stmt("INSERT INTO categories(name,slug) VALUES('X','invalid')"),
    ]),
  ).rejects.toThrow();
  expect(
    await db.first("SELECT count(*) n FROM categories WHERE slug='atomic'"),
  ).toEqual({ n: 0 });
});
test("esquema e identidad no configurados fallan cerrado", async () => {
  await expect(
    deploymentState(connect(env.DB), "not-the-target"),
  ).rejects.toMatchObject({ status: 503 });
  expect(selectMigrations([])).toEqual(migrationFiles);
  expect(() => selectMigrations([migrationFiles[1]])).toThrow();
  expect(() => selectMigrations(["unexpected.sql"])).toThrow();
});
