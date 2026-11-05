import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkTarget } from "./targets.js";
const target = await checkTarget(["--target", "staging"]);
const auth = await readFile(join(process.env.APPDATA, "xdg.config/.wrangler/config/default.toml"), "utf8");
const token = auth.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
const since = process.argv[2] === "--current"
  ? JSON.parse(await readFile(new URL("../private/staging-current-session.json", import.meta.url), "utf8")).deployedAt
  : process.argv[2] || new Date(Date.now() - 10 * 60_000).toISOString();
const query = `query($accountTag:string,$scriptName:string,$start:string,$end:string){__type(name:"AccountWorkersInvocationsAdaptiveQuantiles"){name fields{name description}} viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptive(limit:100,filter:{scriptName:$scriptName,datetime_geq:$start,datetime_leq:$end}){dimensions{datetime scriptName status}sum{requests errors subrequests}quantiles{cpuTimeP50 cpuTimeP99}}}}}`;
try {
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ query, variables: { accountTag: target.accountId, scriptName: target.worker, start: since, end: new Date().toISOString() } }) });
  const data = await response.json();
  if (!response.ok || data.errors?.length) throw Error(`Analytics access failed: ${data.errors?.map(error => error.message).join("; ") || response.status}`);
  const rows = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
  await writeFile(new URL("../private/staging-metrics.json", import.meta.url), JSON.stringify({ since, collectedAt: new Date().toISOString(), rows }), { mode: 0o600 });
  console.log(JSON.stringify({ worker: target.worker, since, rows: rows.length, requests: rows.reduce((sum, row) => sum + row.sum.requests, 0), errors: rows.reduce((sum, row) => sum + row.sum.errors, 0), maxBucketCpuP99Raw: rows.length ? Math.max(...rows.map(row => row.quantiles.cpuTimeP99)) : null, cpuFieldDescriptions: data.data?.__type?.fields?.filter(field => /cpuTimeP(50|99)$/.test(field.name)), cpuUnitsNotAssumed: true, noRequestBodiesCollected: true }));
} catch (error) {
  const failure = { metricsUnavailable: true, since, collectedAt: new Date().toISOString(), reason: error.message };
  // Replace stale success data: an unavailable sample must never look measured.
  await writeFile(new URL("../private/staging-metrics.json", import.meta.url), JSON.stringify(failure), { mode: 0o600 });
  console.error(JSON.stringify(failure)); process.exitCode = 1;
}
