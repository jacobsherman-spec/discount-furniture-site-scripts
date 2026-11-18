import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OPERATION_CATALOG, OPERATION_CATALOG_VERSION, OPERATION_CATALOG_SOURCE } from "./operations-registry.js";

export const CONNECTOR_VERSION = "0.2.0";

export function runtimeMetadata(moduleUrl, writesEnabled) {
  const operations = Object.values(OPERATION_CATALOG);
  let executableHash = null;
  try {
    executableHash = createHash("sha256").update(readFileSync(fileURLToPath(moduleUrl))).digest("hex");
  } catch { /* Source/test callers may not have a packaged executable. */ }
  return Object.freeze({
    connector_version: CONNECTOR_VERSION,
    executable_sha256: executableHash,
    registry_version: OPERATION_CATALOG_VERSION,
    registry_source: OPERATION_CATALOG_SOURCE,
    registry_sha256: createHash("sha256").update(JSON.stringify(OPERATION_CATALOG)).digest("hex"),
    operation_counts: {
      total: operations.length,
      read: operations.filter((operation) => operation.effect === "read").length,
      write: operations.filter((operation) => operation.effect === "write").length,
    },
    writes_enabled: Boolean(writesEnabled),
    verification_contract: "expected-state-v1",
  });
}
