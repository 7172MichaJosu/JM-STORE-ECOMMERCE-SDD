import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
const directory = new URL("../private/", import.meta.url);
const local = parseEnv(await readFile(new URL("../.dev.vars", import.meta.url), "utf8"));
const cliAuth = JSON.parse(await readFile(join(process.env.USERPROFILE, ".config/configstore/firebase-tools.json"), "utf8"));
const token = cliAuth.tokens?.access_token;
const projectId = local.FIREBASE_PROJECT_ID;
if (!token || Date.now() >= cliAuth.tokens.expires_at) throw Error("Firebase CLI session required; run firebase login or projects:list to refresh it.");
async function google(url, method = "GET", body) {
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) {
    let message = String(data.error?.message || "");
    for (const secret of [token, ...Object.values(local).filter(value => value.length >= 20)]) message = message.replaceAll(secret, "[REDACTED]");
    throw Error(`Google ${new URL(url).hostname} ${method} returned ${response.status} (${data.error?.status || "ERROR"}): ${message.slice(0, 700)}`);
  }
  return data;
}
const save = (name, value) => writeFile(new URL(name, directory), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const saveBefore = async (name, value) => {
  try { await writeFile(new URL(name, directory), JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
};
try {
  const project = await google(`https://firebase.googleapis.com/v1beta1/projects/${projectId}`);
  if (project.projectId !== projectId || project.state !== "ACTIVE") throw Error("Firebase project identity mismatch.");
  const billing = await google(`https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`);
  if (billing.billingEnabled) throw Error("Billing is enabled; stop to review Spark-only constraint.");
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  let config = await google(configUrl);
  if (config.subtype === "IDENTITY_PLATFORM") throw Error("Identity Platform is already active; stop before changing the project.");
  await saveBefore("firebase-config-before.json", config);
  await saveBefore("firebase-project-before.json", project);
  await saveBefore("firebase-billing-before.json", billing);
  const lookup = await google(`https://apikeys.googleapis.com/v2/keys:lookupKey?keyString=${encodeURIComponent(local.FIREBASE_API_KEY)}`);
  if (!lookup.name?.startsWith(`projects/${project.projectNumber}/locations/global/keys/`)) throw Error("Firebase API key belongs to a different project.");
  let key = await google(`https://apikeys.googleapis.com/v2/${lookup.name}`);
  await saveBefore("firebase-key-restrictions-before.json", key);
  const hostname = "jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev";
  const callbackUri = `https://${hostname}/admin/mi-cuenta/seguridad/confirmar-correo`;
  if (process.argv[2] === "configure") {
    if (!config.signIn?.email?.enabled || !config.signIn?.email?.passwordRequired) throw Error("Email/password is not enabled; operator configuration must be reviewed.");
    const patch = {
      authorizedDomains: [...new Set([...(config.authorizedDomains || []), hostname])],
      passwordPolicyConfig: { passwordPolicyEnforcementState: "ENFORCE", passwordPolicyVersions: [{ customStrengthOptions: { ...config.passwordPolicyConfig?.passwordPolicyVersions?.[0]?.customStrengthOptions, minPasswordLength: 12, maxPasswordLength: 128 } }] },
      emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
      notification: { sendEmail: { callbackUri } },
    };
    delete patch.notification;
    config = await google(`${configUrl}?updateMask=authorizedDomains,passwordPolicyConfig.passwordPolicyEnforcementState,passwordPolicyConfig.passwordPolicyVersions,emailPrivacyConfig`, "PATCH", patch);
    key = await google(`https://apikeys.googleapis.com/v2/${lookup.name}?updateMask=restrictions.apiTargets`, "PATCH", { restrictions: { apiTargets: [{ service: "identitytoolkit.googleapis.com" }, { service: "securetoken.googleapis.com" }] } });
    // API Keys updates can return an asynchronous operation; re-read the actual key.
    for (let attempt = 0; attempt < 5; attempt++) {
      key = await google(`https://apikeys.googleapis.com/v2/${lookup.name}`);
      if (key.restrictions?.apiTargets?.length === 2) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  const policy = config.passwordPolicyConfig?.passwordPolicyVersions?.[0]?.customStrengthOptions;
  const requiredApis = new Set(key.restrictions?.apiTargets?.map(target => target.service));
  const result = {
    checkedAt: new Date().toISOString(), projectVerified: true, sparkBillingDisabled: billing.billingEnabled === false,
    identityPlatformEnabled: config.subtype === "IDENTITY_PLATFORM", emailPasswordEnabled: config.signIn?.email?.enabled === true && config.signIn?.email?.passwordRequired === true,
    stagingDomainAuthorized: config.authorizedDomains?.includes(hostname) === true,
    eepEnabled: config.emailPrivacyConfig?.enableImprovedEmailPrivacy === true,
    passwordPolicyMatches: config.passwordPolicyConfig?.passwordPolicyEnforcementState === "ENFORCE" && policy?.minPasswordLength === 12 && policy?.maxPasswordLength === 128,
    emailActionMatches: config.notification?.sendEmail?.callbackUri === callbackUri,
    apiKeyProjectMatches: true, apiRestrictionsMatch: requiredApis.size === 2 && requiredApis.has("identitytoolkit.googleapis.com") && requiredApis.has("securetoken.googleapis.com"),
    configurationChanged: process.argv[2] === "configure",
  };
  result.verified = result.sparkBillingDisabled && !result.identityPlatformEnabled && result.emailPasswordEnabled && result.stagingDomainAuthorized && result.eepEnabled && result.passwordPolicyMatches && result.emailActionMatches && result.apiRestrictionsMatch;
  await save("firebase-admin-preflight.json", result);
  console.log(JSON.stringify(result, null, 2));
  if (!result.verified) process.exitCode = 1;
} catch (error) { console.error(JSON.stringify({ firebasePreflightFailed: true, reason: error.message })); process.exitCode = 1; }
