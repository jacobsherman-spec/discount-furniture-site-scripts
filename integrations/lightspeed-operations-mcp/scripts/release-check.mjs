#!/usr/bin/env node

import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, "..");

function run(script, extraArguments = []) {
  const result = spawnSync(process.execPath, [resolve(scriptDirectory, script), ...extraArguments], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

const specIndex = process.argv.indexOf("--spec");
if (specIndex !== -1 && !process.argv[specIndex + 1]) {
  console.error("--spec requires a path");
  process.exit(2);
}
const registryArguments =
  specIndex === -1 ? [] : ["--spec", resolve(process.argv[specIndex + 1])];

run("check-registry-reproducibility.mjs", registryArguments);
run("check-repository-safety.mjs");

if (process.argv.includes("--require-build")) {
  const bundlePath = resolve(packageRoot, "dist", "server.mjs");
  if (!existsSync(bundlePath) || statSync(bundlePath).size === 0) {
    console.error("Built MCP bundle is missing or empty. Run pnpm build first.");
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, check: "release", build_required: process.argv.includes("--require-build") }, null, 2));
