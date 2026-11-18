#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sourceArgument = process.argv[2];
if (!sourceArgument) {
  console.error("Usage: registry-catalog-hash.mjs <operations-registry.js>");
  process.exit(2);
}

const sourcePath = resolve(sourceArgument);
if (!existsSync(sourcePath)) {
  console.error("Operation registry source does not exist");
  process.exit(2);
}

const moduleUrl = `${pathToFileURL(sourcePath).href}?catalog-hash=${Date.now()}`;
const { OPERATION_CATALOG } = await import(moduleUrl);
if (!OPERATION_CATALOG || typeof OPERATION_CATALOG !== "object" || Array.isArray(OPERATION_CATALOG)) {
  console.error("Operation registry source does not export OPERATION_CATALOG");
  process.exit(2);
}

process.stdout.write(createHash("sha256").update(JSON.stringify(OPERATION_CATALOG)).digest("hex"));
