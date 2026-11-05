import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const config = parseEnv(await readFile(new URL("../.dev.vars", import.meta.url), "utf8"));
try {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(config.FIREBASE_API_KEY)}`);
  if (!response.ok) throw Error(`Firebase public configuration returned ${response.status}; response withheld.`);
  const data = await response.json();
  const hostname = "jm-store-ecommerce-sdd-staging.josue-hinostroza-27.workers.dev";
  // The public legacy endpoint can report a numeric project number as projectId.
  const projectNumberReturned = /^\d+$/.test(String(data.projectId));
  const projectMatches = projectNumberReturned ? null : data.projectId === config.FIREBASE_PROJECT_ID;
  const stagingAuthorized = data.authorizedDomains?.includes(hostname) === true;
  await writeFile(new URL("../private/firebase-public-preflight.json", import.meta.url), JSON.stringify({ ...data, checkedAt: new Date().toISOString() }), { mode: 0o600 });
  console.log(JSON.stringify({ projectMatches, projectNumberReturned, stagingAuthorized, providerContacted: true, readOnly: true, billingAndAdminSettingsVerified: false }));
  if (projectMatches === false || !stagingAuthorized) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
