import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Test-only provider. Every outbound request is handled here, with no network fallback.
export function firebaseDouble({ actionsFile } = {}) {
  const projectId = "jm-store-local-synthetic";
  const apiKey = "synthetic-firebase-local-test-api-key";
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = randomUUID();
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" };
  const accounts = new Map(), refreshes = new Map(), actions = new Map();
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "public,max-age=60" } });
  const denied = () => json({ error: { message: "INVALID_LOGIN_CREDENTIALS" } }, 400);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  function token(account) {
    const now = Math.floor(Date.now() / 1000);
    const content = `${encode({ alg: "RS256", typ: "JWT", kid })}.${encode({ iss: `https://securetoken.google.com/${projectId}`, aud: projectId, sub: account.uid, user_id: account.uid, email: account.email, email_verified: true, iat: now - 1, auth_time: now - 2, exp: now + 3600, firebase: { sign_in_provider: "password" } })}`;
    return `${content}.${createSign("RSA-SHA256").update(content).sign(privateKey).toString("base64url")}`;
  }
  function identity(account) {
    const refreshToken = randomUUID(); refreshes.set(refreshToken, account.uid);
    return { localId: account.uid, email: account.email, idToken: token(account), refreshToken, expiresIn: "3600" };
  }
  function accountForToken(raw) {
    try { return accounts.get(JSON.parse(Buffer.from(raw.split(".")[1], "base64url")).sub); } catch { return null; }
  }
  function addAccount(email, password) {
    const account = { uid: randomUUID(), email, password, disabled: false };
    accounts.set(account.uid, account); return account;
  }
  async function fetch(request) {
    const url = new URL(request.url);
    if (url.origin === "https://www.googleapis.com" && url.pathname === "/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com") return json({ keys: [jwk] });
    if (!["identitytoolkit.googleapis.com", "securetoken.googleapis.com"].includes(url.hostname) || url.searchParams.get("key") !== apiKey) return denied();
    const body = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(await request.text())) : await request.json();
    if (url.hostname === "securetoken.googleapis.com") {
      const account = accounts.get(refreshes.get(body.refresh_token));
      if (!account || account.disabled) return denied();
      const fresh = identity(account);
      return json({ user_id: account.uid, id_token: fresh.idToken, refresh_token: fresh.refreshToken, expires_in: "3600" });
    }
    const method = url.pathname.split(":")[1];
    if (method === "signUp") {
      if ([...accounts.values()].some(account => account.email === body.email)) return denied();
      return json(identity(addAccount(body.email, body.password)));
    }
    if (method === "signInWithPassword") {
      const account = [...accounts.values()].find(account => account.email === body.email && account.password === body.password && !account.disabled);
      return account ? json(identity(account)) : denied();
    }
    const account = accountForToken(body.idToken || "");
    if (method === "lookup") return account && !account.disabled ? json({ users: [{ localId: account.uid, email: account.email, emailVerified: true, disabled: false, validSince: "0" }] }) : denied();
    if (method === "sendOobCode" && account) {
      const oobCode = randomUUID();
      const action = { oobCode, operationId: new URL(body.continueUrl).searchParams.get("operation"), uid: account.uid, email: account.email, newEmail: body.newEmail, used: false };
      actions.set(oobCode, action);
      if (actionsFile) await writeFile(actionsFile, JSON.stringify([...actions.values()]), { mode: 0o600 });
      return json({ email: body.newEmail });
    }
    const action = actions.get(body.oobCode);
    if (action && actionsFile) {
      const controls = JSON.parse(await readFile(actionsFile, "utf8"));
      if (controls.find(control => control.oobCode === body.oobCode)?.expired) return denied();
    }
    if (method === "resetPassword") return action && !action.used ? json({ requestType: "VERIFY_AND_CHANGE_EMAIL", email: action.email, newEmail: action.newEmail }) : denied();
    if (method === "update" && action && !action.used) {
      const owner = accounts.get(action.uid);
      if (!owner) return denied();
      owner.email = action.newEmail; action.used = true;
      return json({ localId: owner.uid, email: owner.email });
    }
    if (method === "update" && account && body.password) { account.password = body.password; return json(identity(account)); }
    if (method === "delete" && account) { accounts.delete(account.uid); return json({}); }
    return denied();
  }
  return { projectId, apiKey, addAccount, fetch };
}
