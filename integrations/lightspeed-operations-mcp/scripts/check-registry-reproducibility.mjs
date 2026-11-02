#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const PINNED_SOURCE_URL = "https://x-series-api.lightspeedhq.com/openapi/api-2026-07.yaml";
const PINNED_SOURCE_SHA256 = "d5537aa408bb9b79aedd9eb9efc05a38e881635683cef08f13108e4665dca4f9";
const EXPECTED_COUNTS = Object.freeze({ implemented: 201, reads: 107, writes: 94, excluded: 18 });

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const registryPath = join(packageRoot, "src", "operations-registry.js");
const capabilitiesPath = join(packageRoot, "CAPABILITIES.md");
const generatorPath = join(repositoryRoot, "scripts", "build-lightspeed-operation-registry.mjs");

function fail(message) {
  throw new Error(message);
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  if (!process.argv[index + 1]) fail(`${flag} requires a path`);
  return resolve(process.argv[index + 1]);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizedRegistry(text) {
  return text
    .replaceAll("\r\n", "\n")
    .replace(
      /^export const OPERATION_CATALOG_GENERATED_AT = .*;$/m,
      'export const OPERATION_CATALOG_GENERATED_AT = "<normalized>";',
    );
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) fail(`${label} is missing expected value: ${expected}`);
}

const registryText = readFileSync(registryPath, "utf8");
const capabilitiesText = readFileSync(capabilitiesPath, "utf8");
assertIncludes(registryText, `// Source: ${PINNED_SOURCE_URL}`, "registry source URL");
assertIncludes(registryText, `// Source SHA-256: ${PINNED_SOURCE_SHA256}`, "registry source hash");
assertIncludes(capabilitiesText, `- Source SHA-256: \`${PINNED_SOURCE_SHA256}\``, "capability source hash");

const registryModule = await import(`${pathToFileURL(registryPath).href}?check=${Date.now()}`);
const operations = Object.values(registryModule.OPERATION_CATALOG);
const observedCounts = {
  implemented: operations.length,
  reads: operations.filter((entry) => entry.effect === "read").length,
  writes: operations.filter((entry) => entry.effect === "write").length,
  excluded: registryModule.EXCLUDED_OPERATION_COUNT,
};
for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
  if (observedCounts[name] !== expected) {
    fail(`registry ${name} count changed: expected ${expected}, observed ${observedCounts[name]}`);
  }
}
assertIncludes(capabilitiesText, `- Implemented operations: ${EXPECTED_COUNTS.implemented}`, "capability operation count");
assertIncludes(capabilitiesText, `- Read-only operations: ${EXPECTED_COUNTS.reads}`, "capability read count");
assertIncludes(capabilitiesText, `- Preview-gated write operations: ${EXPECTED_COUNTS.writes}`, "capability write count");
assertIncludes(capabilitiesText, `- Excluded source operations: ${EXPECTED_COUNTS.excluded}`, "capability exclusion count");

const explicitSpec = valueAfter("--spec");
const defaultSpec = resolve(repositoryRoot, "..", "specs", "lightspeed-api-2026-07.json");
const specPath = explicitSpec || process.env.LIGHTSPEED_OPENAPI_SPEC || (existsSync(defaultSpec) ? defaultSpec : null);
let reproduction = "hash-and-counts-only";

if (specPath) {
  const resolvedSpecPath = resolve(specPath);
  if (!existsSync(resolvedSpecPath)) fail(`OpenAPI snapshot not found: ${resolvedSpecPath}`);
  const observedHash = sha256(resolvedSpecPath);
  if (observedHash !== PINNED_SOURCE_SHA256) {
    fail(`OpenAPI snapshot hash mismatch: expected ${PINNED_SOURCE_SHA256}, observed ${observedHash}`);
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "df-lightspeed-registry-"));
  try {
    const generatedRegistry = join(temporaryDirectory, "operations-registry.js");
    const generatedCapabilities = join(temporaryDirectory, "CAPABILITIES.md");
    const result = spawnSync(
      process.execPath,
      [generatorPath, resolvedSpecPath, generatedRegistry, generatedCapabilities],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    if (result.status !== 0) {
      fail(`registry generator failed:\n${result.stderr || result.stdout || `exit ${result.status}`}`);
    }
    if (normalizedRegistry(readFileSync(generatedRegistry, "utf8")) !== normalizedRegistry(registryText)) {
      fail("operations-registry.js does not reproduce from the pinned OpenAPI snapshot");
    }
    if (readFileSync(generatedCapabilities, "utf8").replaceAll("\r\n", "\n") !== capabilitiesText.replaceAll("\r\n", "\n")) {
      fail("CAPABILITIES.md does not reproduce from the pinned OpenAPI snapshot");
    }
    reproduction = "full-pinned-snapshot";
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({
  ok: true,
  source_url: PINNED_SOURCE_URL,
  source_sha256: PINNED_SOURCE_SHA256,
  counts: observedCounts,
  reproduction,
}, null, 2));
