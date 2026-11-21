import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = resolve(root, "node_modules/next/dist/bin/next");

const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
