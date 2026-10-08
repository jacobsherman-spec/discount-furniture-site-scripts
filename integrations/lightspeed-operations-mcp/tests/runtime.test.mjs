import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadProtectedCredential } from "../src/credential-loader.mjs";
import { CONNECTOR_VERSION, runtimeMetadata } from "../src/runtime-metadata.mjs";
import { OPERATION_CATALOG } from "../src/operations-registry.js";

test("plaintext environment credentials fail without echoing their values", async () => {
  await assert.rejects(loadProtectedCredential({ DF_LIGHTSPEED_TOKEN: "sensitive-test-value" }), (error) => {
    assert.match(error.message, /Plaintext environment credentials are disabled/);
    assert.ok(!error.message.includes("sensitive-test-value"));
    return true;
  });
});

test("runtime identity exposes reproducible code and catalog fingerprints", () => {
  const metadata = runtimeMetadata(import.meta.url, false);
  const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(metadata.connector_version, CONNECTOR_VERSION);
  assert.equal(metadata.connector_version, packageMetadata.version);
  assert.match(metadata.executable_sha256, /^[a-f0-9]{64}$/);
  assert.match(metadata.registry_sha256, /^[a-f0-9]{64}$/);
  assert.equal(metadata.operation_counts.total, metadata.operation_counts.read + metadata.operation_counts.write);
  assert.equal(metadata.writes_enabled, false);
  assert.deepEqual(runtimeMetadata(import.meta.url, false), metadata);
});

test("installer registry fingerprint matches the runtime catalog fingerprint", () => {
  const helperPath = fileURLToPath(new URL("../scripts/registry-catalog-hash.mjs", import.meta.url));
  const registryPath = fileURLToPath(new URL("../src/operations-registry.js", import.meta.url));
  const result = spawnSync(process.execPath, [helperPath, registryPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), runtimeMetadata(import.meta.url, false).registry_sha256);
  assert.equal(
    result.stdout.trim(),
    createHash("sha256").update(JSON.stringify(OPERATION_CATALOG)).digest("hex"),
  );
});
