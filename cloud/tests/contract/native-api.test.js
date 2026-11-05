import { expect, test } from "vitest";
import { SELF } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { seedMinimal } from "../fixtures/database.js";

test("native API rejects malformed/oversized/unsupported bodies without losing security headers", async () => {
  await seedMinimal(env.DB);
  for (const [body, contentType, status, code] of [
    ["{broken", "application/json", 400, "INVALID_JSON"],
    ["1".repeat(102401), "application/json", 413, "BODY_TOO_LARGE"],
    ["hello", "text/plain", 415, "UNSUPPORTED_MEDIA_TYPE"],
    ["null", "application/json", 400, "INVALID_JSON"],
  ]) {
    const result = await SELF.fetch("http://localhost:8787/api/auth/login", { method: "POST", headers: { "content-type": contentType }, body });
    expect(result.status).toBe(status); expect((await result.json()).error.code).toBe(code);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  }
  const head = await SELF.fetch("http://localhost:8787/api/health", { method: "HEAD" });
  expect(head.status).toBe(200); expect(await head.text()).toBe("");
  const duplicate = await SELF.fetch("http://localhost:8787/api/products?q=a&q=b");
  expect(duplicate.status).toBe(422);
});

test("native API bounds a streamed body without Content-Length and rejects malformed route escapes", async () => {
  await seedMinimal(env.DB);
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(60 * 1024).fill(32));
    controller.enqueue(new Uint8Array(60 * 1024).fill(32)); controller.close();
  } });
  const oversized = await SELF.fetch("http://localhost:8787/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body });
  expect(oversized.status).toBe(413); expect((await oversized.json()).error.code).toBe("BODY_TOO_LARGE");
  const malformed = await SELF.fetch("http://localhost:8787/api/products/%E0%A4%A");
  expect(malformed.status).toBe(400); expect((await malformed.json()).error.code).toBe("INVALID_PATH");
});
