import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = path.resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
);
if (existsSync(path.join(root, ".env.local")))
  process.loadEnvFile(path.join(root, ".env.local"));
export function configuration(overrides = {}) {
  const c = {
    databasePath: path.resolve(
      root,
      process.env.DATABASE_PATH || "server/data/jm-store.sqlite",
    ),
    quoteSecret: process.env.QUOTE_SECRET,
    origin: process.env.APP_ORIGIN || "http://localhost:5173",
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3001),
    ...overrides,
  };
  if (!c.quoteSecret || Buffer.byteLength(c.quoteSecret) < 32)
    throw Error("Configura QUOTE_SECRET local con al menos 32 bytes.");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.origin))
    throw Error("APP_ORIGIN debe ser el origen local de la demostración.");
  return c;
}
