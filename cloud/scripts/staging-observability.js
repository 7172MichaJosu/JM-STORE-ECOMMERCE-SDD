import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { checkTarget } from "./targets.js";
const target = await checkTarget(["--target", "staging"]);
const session = JSON.parse(await readFile(new URL("../private/staging-current-session.json", import.meta.url), "utf8"));
const auth = await readFile(join(process.env.APPDATA, "xdg.config/.wrangler/config/default.toml"), "utf8");
const token = auth.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
try {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/workers/observability/telemetry/query`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ queryId: randomUUID(), timeframe: { from: Date.parse(session.deployedAt || session.createdAt), to: Date.now() }, view: "calculations", chartType: "aggregate", limit: 20, parameters: { datasets: ["cloudflare-workers"], filterCombination: "and", filters: [{ key: "$workers.scriptName", operation: "eq", type: "string", value: target.worker }], calculations: [{ operator: "count", alias: "requests" }, { operator: "max", key: "$workers.cpuTimeMs", keyType: "number", alias: "cpu_max_ms" }, { operator: "avg", key: "$workers.cpuTimeMs", keyType: "number", alias: "cpu_avg_ms" }, { operator: "max", key: "$workers.wallTimeMs", keyType: "number", alias: "wall_max_ms" }] } }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw Error(`Observability query returned ${response.status}: ${data.errors?.map(error => error.message).join(";") || "no metrics"}`);
  await writeFile(new URL("../private/staging-observability.json", import.meta.url), JSON.stringify(data.result), { mode: 0o600 });
  const calculations = (data.result.calculations || []).map(calc => ({ alias: calc.alias || calc.calculation, values: (calc.aggregates || []).map(value => value.value) }));
  const maxCpu = calculations.find(calc => calc.alias === "cpu_max_ms")?.values?.[0];
  console.log(JSON.stringify({ worker: target.worker, calculations, maxCpuMs: maxCpu ?? null, freeCpuLimitMs: 10, budgetExceeded: typeof maxCpu === "number" && maxCpu > 10, memoryUsageNotExposed: true }, null, 2));
  if (typeof maxCpu === "number" && maxCpu > 10) process.exitCode = 2;
} catch (error) { console.error(JSON.stringify({ observabilityUnavailable: true, reason: error.message })); process.exitCode = 1; }
