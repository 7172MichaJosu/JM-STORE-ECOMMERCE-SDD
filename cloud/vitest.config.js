import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.staging.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL("./migrations", import.meta.url)),
          ),
          QUOTE_SECRET: randomBytes(32).toString("hex"),
          RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
        },
      },
    }),
  ],
  test: {
    include: [
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js",
      "tests/contract/**/*.test.js",
    ],
    setupFiles: ["./tests/setup.js"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
