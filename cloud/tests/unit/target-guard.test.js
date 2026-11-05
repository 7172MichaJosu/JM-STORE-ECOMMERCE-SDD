import { test, expect } from "vitest";
import { validateTarget, configuration } from "../../src/config.js";
import { env } from "cloudflare:workers";
const target = {
  environment: "staging",
  accountId: "1".repeat(32),
  worker: "jm-store-ecommerce-sdd-staging",
  databaseId: "11111111-1111-4111-8111-111111111111",
  origin: "https://jm-store-ecommerce-sdd-staging.example.workers.dev",
};
const list = {
  staging: target,
  forbiddenWorkers: ["JM-STORE"],
  forbiddenDatabases: ["22222222-2222-4222-8222-222222222222"],
};
test("target completo coincide, vacío o diferente falla cerrado", () => {
  expect(validateTarget(target, list)).toEqual(target);
  for (const field of [
    "environment",
    "accountId",
    "worker",
    "databaseId",
    "origin",
  ])
    expect(() => validateTarget({ ...target, [field]: "" }, list)).toThrow();
  expect(() =>
    validateTarget({ ...target, accountId: "2".repeat(32) }, list),
  ).toThrow();
  expect(() =>
    validateTarget({ ...target, databaseId: list.forbiddenDatabases[0] }, list),
  ).toThrow();
  expect(() =>
    validateTarget({ ...target, worker: "JM-STORE" }, list),
  ).toThrow();
  expect(() =>
    validateTarget({ ...target, origin: "http://insecure.test" }, list),
  ).toThrow();
});
test("bindings/origen/namespace y secretos fallan cerrado", () => {
  expect(configuration(env).identity).toBe("local-only");
  for (const override of [
    { DB: null },
    { QUOTE_SECRET: "" },
    { QUOTE_SECRET: env.RATE_LIMIT_SECRET },
    { SESSION_NAMESPACE: "imported-source" },
    { APP_ORIGIN: "http://untrusted.test" },
  ])
    expect(() => configuration({ ...env, ...override })).toThrow();
  expect(() =>
    validateTarget(target, {
      ...list,
      production: { ...target, environment: "production" },
    }),
  ).toThrow();
});
test("Firebase es obligatorio fuera de local y exige configuración cifrada completa", () => {
  const base = { ...env, ENVIRONMENT: "staging" };
  expect(() => configuration(base)).toThrow();
  const configured = {
    ...base,
    FIREBASE_PROJECT_ID: "jm-test-project",
    FIREBASE_API_KEY: "synthetic-public-web-api-key-value",
    FIREBASE_SESSION_ENCRYPTION_KEY: "ab".repeat(32),
  };
  expect(configuration(configured).firebase).toMatchObject({ projectId: "jm-test-project", apiKey: "synthetic-public-web-api-key-value" });
  for (const override of [
    { AUTH_PROVIDER: "unknown" },
    { AUTH_PROVIDER: "local" },
    { FIREBASE_PROJECT_ID: "../bad" },
    { FIREBASE_API_KEY: "" },
    { FIREBASE_SESSION_ENCRYPTION_KEY: "short" },
    { FIREBASE_SESSION_ENCRYPTION_KEY: "ab".repeat(33) },
  ]) expect(() => configuration({ ...configured, ...override })).toThrow();
});
