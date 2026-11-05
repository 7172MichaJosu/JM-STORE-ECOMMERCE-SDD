import { expect, test } from "vitest";
import { env } from "cloudflare:workers";
import { configuration } from "../../src/config.js";

test("local suites do not inherit Firebase credentials from the operator file", () => {
  for (const name of ["FIREBASE_PROJECT_ID", "FIREBASE_API_KEY", "FIREBASE_SESSION_ENCRYPTION_KEY"])
    expect(Boolean(env[name])).toBe(false);
  expect(configuration(env).firebase === null).toBe(true);
});

test("unmocked outbound requests are answered by the local network fence", async () => {
  const response = await fetch("https://local-network-fence.invalid/never-connect");
  expect(response.status).toBe(503);
  expect(await response.text()).toBe("External requests disabled in local tests");
});
