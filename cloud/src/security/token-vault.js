import { Buffer } from "node:buffer";
let activeKeyHex, activeKey;
function bytes(hex) {
  if (typeof hex !== "string" || !/^[\da-f]{64}$/i.test(hex)) throw new Error("Clave de cifrado de sesión no configurada.");
  return Buffer.from(hex, "hex");
}
function sessionKey(hex) {
  // One non-extractable key per isolate; a changed secret always replaces it.
  if (hex !== activeKeyHex || !activeKey) {
    const raw = bytes(hex);
    activeKeyHex = hex;
    activeKey = crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return activeKey;
}
const b64 = (value) => Buffer.from(value).toString("base64url");
const unb64 = (value) => Buffer.from(value, "base64url");

export async function encryptSessionToken(token, keyHex) {
  const key = await sessionKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return `${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
}

export async function decryptSessionToken(envelope, keyHex) {
  if (typeof envelope !== "string" || envelope.split(".").length !== 2) throw new Error("Token de sesión no válido.");
  const [iv, ciphertext] = envelope.split(".");
  const key = await sessionKey(keyHex);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ciphertext));
  return new TextDecoder().decode(plaintext);
}
