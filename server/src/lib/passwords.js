import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
let active = 0;
const wait = [];
async function key(password, salt) {
  if (active >= 2) await new Promise((r) => wait.push(r));
  active++;
  try {
    return await derive(password, salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 192 * 1024 * 1024,
    });
  } finally {
    active--;
    wait.shift()?.();
  }
}
export async function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$131072$8$1$${salt.toString("hex")}$${(await key(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const parts = (stored || "").split("$");
  const salt =
    parts.length === 6 ? Buffer.from(parts[4], "hex") : Buffer.alloc(16);
  const expected =
    parts.length === 6 ? Buffer.from(parts[5], "hex") : Buffer.alloc(64);
  const result = await key(password, salt);
  return expected.length === 64 && timingSafeEqual(result, expected);
}
