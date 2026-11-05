import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { checkTarget } from "./targets.js";
const target = await checkTarget(["--target", "staging"]);
const root = fileURLToPath(new URL("../../", import.meta.url));
const child = spawn(process.execPath, [root + "node_modules/wrangler/bin/wrangler.js", "tail", "--format", "json", "--config", root + "cloud/wrangler.staging.jsonc"], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"] });
const observations = []; let buffer = "", ran = false, exceeded = false;
const hosted = process.argv.includes("--hosted");
const commerce = process.argv.includes("--commerce");
const crud = process.argv.includes("--crud");
const smoke = process.argv.includes("--smoke") || commerce || hosted || crud;
let finishRun;
const completed = new Promise(resolve => { finishRun = resolve; });
let smokeExitCode = null;
let unknownKeys;
function parse(chunk) {
  buffer += chunk.toString();
  let start = -1, depth = 0, quoted = false, escaped = false, consumed = 0;
  for (let i = 0; i < buffer.length; i++) {
    const c = buffer[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"' && depth) { quoted = true; continue; }
    if (c === "{") { if (!depth) start = i; depth++; }
    if (c === "}" && depth && --depth === 0) {
      try {
        const event = JSON.parse(buffer.slice(start, i + 1));
        const cpu = event.cpuTimeMs ?? event.cpuTime ?? event.CPUTimeMs;
        if (typeof cpu === "number") {
          const row = { cpuMs: cpu, wallMs: event.wallTimeMs ?? event.wallTime ?? null, outcome: event.outcome, path: event.event?.request?.url ? new URL(event.event.request.url).pathname : null };
          observations.push(row); if (cpu > 10) exceeded = true;
        } else unknownKeys = Object.keys(event);
      } catch { /* Never print the raw event, URL query, headers or logs. */ }
      consumed = i + 1;
    }
  }
  if (consumed) buffer = buffer.slice(consumed);
  if (!ran && /Connected|Successfully created tail/i.test(buffer)) { ran = true; run().catch(() => {}).finally(finishRun); }
  if (buffer.length > 200_000) buffer = buffer.slice(-5000);
}
child.stdout.on("data", parse); child.stderr.on("data", parse);
const fallback = setTimeout(() => { if (!ran && child.exitCode === null) { ran = true; run().catch(() => {}).finally(finishRun); } }, 5000);
async function run() {
  await new Promise(resolve => setTimeout(resolve, 1200));
  if (smoke) {
    const probe = spawn(process.execPath, hosted ? [root + "cloud/scripts/hosted-e2e.js", "--target", "staging"] : [root + "cloud/scripts/staging-smoke.js", ...(commerce ? ["--commerce"] : crud ? ["--crud"] : [])], { cwd: root, stdio: "inherit" });
    smokeExitCode = await new Promise(resolve => probe.on("exit", resolve));
    await new Promise(resolve => setTimeout(resolve, 5000));
    return;
  }
  const response = await fetch(target.origin + "/api/auth/session");
  const data = await response.json();
  const cookie = response.headers.getSetCookie().find(value => value.startsWith("__Host-jm-sdd.sid="))?.split(";")[0];
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (exceeded) return;
  const admin = JSON.parse(await readFile(new URL("../private/staging-synthetic-admin.json", import.meta.url), "utf8"));
  await fetch(target.origin + "/api/auth/login", { method: "POST", headers: { origin: target.origin, cookie, "content-type": "application/json", "x-csrf-token": data.data.csrfToken }, body: JSON.stringify({ email: admin.email, password: admin.password }) });
}
if (smoke) {
  let timeout;
  await Promise.race([completed, new Promise(resolve => { timeout = setTimeout(resolve, 300_000); })]);
  clearTimeout(timeout);
} else await new Promise(resolve => setTimeout(resolve, 20_000));
clearTimeout(fallback);
child.kill("SIGINT");
const byPath = Object.values(observations.reduce((groups, row) => {
  const group = groups[row.path] ||= { path: row.path, requests: 0, minCpuMs: Infinity, maxCpuMs: 0 };
  group.requests++; group.minCpuMs = Math.min(group.minCpuMs, row.cpuMs); group.maxCpuMs = Math.max(group.maxCpuMs, row.cpuMs); return groups;
}, {}));
const report = { collectedAt: new Date().toISOString(), mode: hosted ? "hosted" : commerce ? "commerce" : crud ? "crud" : smoke ? "smoke" : "probe", observations, exceeded, unknownKeys, smokeExitCode };
await writeFile(new URL("../private/staging-tail-cpu.json", import.meta.url), JSON.stringify(report), { mode: 0o600 });
console.log(JSON.stringify({ byPath, measuredRequests: observations.length, maxCpuMs: Math.max(0, ...observations.map(row => row.cpuMs)), exceededFreeCpu: exceeded, metricsPresent: observations.length > 0, nonSensitiveEventFieldNames: unknownKeys, probeAttempted: ran, smokeExitCode, childExitCode: child.exitCode, noRawEventsPrinted: true }, null, 2));
if (exceeded) process.exitCode = 2;
else if (smoke && (smokeExitCode !== 0 || observations.length < 11)) process.exitCode = 1;
