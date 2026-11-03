import { createApp } from "./app.js";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
const context = createApp(),
  lock = context.config.databasePath + ".lock";
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let running = true;
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (e.code === "ESRCH") running = false;
    else throw e;
  }
  if (running) {
    context.close();
    throw Error("Ya hay una API usando esta base.");
  }
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { flag: "wx" });
context.finish();
const server = context.app.listen(
  context.config.port,
  context.config.host,
  () => console.log(`JM-STORE: http://localhost:${context.config.port}`),
);
const release = () => {
  if (existsSync(lock)) unlinkSync(lock);
};
server.on("error", (e) => {
  release();
  context.close();
  console.error(e.code);
  process.exitCode = 1;
});
process.on("exit", release);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      context.close();
      release();
      process.exit(0);
    }),
  );
