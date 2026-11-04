import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateTarget } from "../src/config.js";
export async function checkTarget(argv) {
  const i = argv.indexOf("--target"),
    targetName = i >= 0 ? argv[i + 1] : null;
  if (!["staging", "production"].includes(targetName))
    throw Error("Usa --target staging|production; no hay destino por defecto.");
  const file = new URL("../deploy/targets.local.json", import.meta.url);
  const allowlist = JSON.parse(await readFile(file, "utf8"));
  return validateTarget(allowlist[targetName], allowlist);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const t = await checkTarget(process.argv.slice(2));
    console.log(
      JSON.stringify({
        target: t.environment,
        worker: t.worker,
        databaseId: t.databaseId,
        dryRun: true,
        remoteChecked: false,
      }),
    );
  } catch {
    console.error(
      "Target no verificado. No se consultó ni modificó Cloudflare. Completa una allowlist privada y pasa --target explícito.",
    );
    process.exitCode = 1;
  }
}
