#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputArg, outputArg, markdownArg] = process.argv.slice(2);
if (!inputArg || !outputArg || !markdownArg) {
  console.error(
    "Usage: node scripts/build-lightspeed-operation-registry.mjs <openapi.json> <registry.js> <capabilities.md>",
  );
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const markdownPath = resolve(markdownArg);
const raw = readFileSync(inputPath, "utf8");
const spec = JSON.parse(raw);

const SOURCE_URL = "https://x-series-api.lightspeedhq.com/openapi/api-2026-07.yaml";
const EXCLUDED_TAGS = new Set(["Audit", "Partner Billing"]);
const EXCLUDED_SCOPES = new Set([
  "audit:read",
  "billing:partner_subscription:read",
  "billing:partner_subscription:write",
  "business_rules:read",
  "business_rules:write",
  "remote_rules:read",
  "remote_rules:write",
  "users:read:primary_admin",
  "users:write",
]);
const EXCLUDED_OPERATIONS = new Set([
  "DeleteUserByID",
  "DeleteSessionsByUserID",
  "ListShifts",
  "UploadImage", // multipart upload is intentionally browser/API-specialized, not JSON proxied
]);

const SCOPE_OVERRIDES = new Map([
  ["CreateProduct", ["products:write", "products:write:costs"]],
  ["CreateStoreCreditHold", ["store_credits:write:redeem"]],
  ["CreateStoreCreditTransaction", ["store_credits:write:issue", "store_credits:write:redeem"]],
  ["GetProductByID", ["products:read", "products:read:costs"]],
  ["GetSalesTotalsForUserByID", ["sales:read", "users:read"]],
  ["ListInventoryLevels", ["inventory:read", "products:read:costs"]],
  ["ListInventoryRecords", ["inventory:read", "products:read:costs"]],
  ["ListProductInventoryLevels", ["inventory:read", "products:read:costs"]],
  ["ListProductInventoryRecords", ["inventory:read", "products:read:costs"]],
  ["ListProducts", ["products:read", "products:read:costs"]],
  ["ReverseStoreCreditHold", ["store_credits:write:redeem"]],
  ["UpdateProduct", ["products:write", "products:write:costs"]],
  ["getFulfillmentSummary", ["fulfillments:read"]],
  ["get-webhooks", ["webhooks"]],
  ["get-webhooks-id", ["webhooks"]],
  ["post-webhooks", ["webhooks"]],
  ["put-webhooks-id", ["webhooks"]],
  ["delete-webhooks-webhookId", ["webhooks"]],
]);

const READ_POST_OPERATIONS = new Set([
  "ApplyDiscount",
  "BulkBalancesStoreCreditList",
  "BulkStoreCreditList",
  "GetActivePromoCodesBulk",
  "GetUsersById",
  "ListInventoryLevels",
  "ListInventoryRecords",
  "getPartialPackingSlip",
]);

const FINANCIAL_TAGS = new Set([
  "Gift Cards",
  "Registers",
  "Sales",
  "Store Credits",
]);

const HIGH_RISK_OPERATION_WORDS = [
  "close",
  "delete",
  "fulfill",
  "hold",
  "issue",
  "openregister",
  "redeem",
  "return",
  "reverse",
  "void",
];

function extractScopes(description = "") {
  const scopes = new Set();
  // A single "Requires" sentence can list several scopes before the final
  // word "scopes". Collect every backticked scope token, not just the last.
  for (const match of description.matchAll(/`((?:[a-z_]+:)+[a-z_]+)`/g)) {
    scopes.add(match[1]);
  }
  return [...scopes].sort();
}

function resolveLocalRef(value) {
  if (!value?.$ref) return value;
  if (!value.$ref.startsWith("#/")) throw new Error(`Unsupported OpenAPI reference: ${value.$ref}`);
  let current = spec;
  for (const encodedPart of value.$ref.slice(2).split("/")) {
    const part = encodedPart.replace(/~1/g, "/").replace(/~0/g, "~");
    current = current?.[part];
  }
  if (!current) throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`);
  return current;
}

function parametersFor(pathItem, operation) {
  const merged = [...(pathItem.parameters || []), ...(operation.parameters || [])].map(resolveLocalRef);
  const unique = new Map();
  for (const parameter of merged) unique.set(`${parameter.in}:${parameter.name}`, parameter);
  return [...unique.values()];
}

function listParameters(pathItem, operation, location, requiredOnly = false) {
  return parametersFor(pathItem, operation)
    .filter((parameter) => parameter.in === location)
    .filter((parameter) => !requiredOnly || parameter.required === true)
    .map((parameter) => parameter.name);
}

function classifyEffect(method, operationId) {
  if (method === "GET" || READ_POST_OPERATIONS.has(operationId)) return "read";
  return "write";
}

function classifyRisk(operation) {
  if (operation.effect === "read") return "read_only";
  const normalized = operation.operation_id.toLowerCase();
  if (FINANCIAL_TAGS.has(operation.tag)) return "financial_or_sale_record";
  if (operation.method === "DELETE") return "destructive";
  if (HIGH_RISK_OPERATION_WORDS.some((word) => normalized.includes(word))) return "high_impact";
  if (operation.tag === "Inventory" || operation.tag.includes("Consignment")) return "inventory_control";
  return "business_record_write";
}

function operationFromSpec(path, pathItem, method, operation) {
  const operationId = operation.operationId || "";
  const tag = operation.tags?.[0] || "Other";
  const scopes = SCOPE_OVERRIDES.get(operationId) || extractScopes(operation.description || "");
  const requestBody = operation.requestBody ? resolveLocalRef(operation.requestBody) : null;
  const contentTypes = Object.keys(requestBody?.content || {});
  const entry = {
    operation_id: operationId,
    api_version: "2026-07",
    method,
    path: `/api/2026-07${path}`,
    tag,
    summary: operation.summary || operationId,
    scopes,
    path_parameters: listParameters(pathItem, operation, "path"),
    query_parameters: listParameters(pathItem, operation, "query"),
    required_query_parameters: listParameters(pathItem, operation, "query", true),
    accepts_json_body:
      Boolean(requestBody) &&
      (contentTypes.length === 0 || contentTypes.some((value) => value.includes("json"))),
    body_required: Boolean(requestBody?.required),
    effect: classifyEffect(method, operationId),
    lifecycle: "current",
  };
  entry.risk = classifyRisk(entry);
  return entry;
}

const operations = [];
const exclusions = [];
for (const [path, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem[method];
    if (!operation) continue;
    const entry = operationFromSpec(path, pathItem, method.toUpperCase(), operation);
    let reason = null;
    if (!entry.operation_id) reason = "missing stable operation id";
    else if (EXCLUDED_TAGS.has(entry.tag)) reason = "outside approved operational scope";
    else if (EXCLUDED_OPERATIONS.has(entry.operation_id)) reason = "requires a specialized implementation";
    else if (entry.scopes.some((scope) => EXCLUDED_SCOPES.has(scope))) reason = "requires excluded scope";
    else if (operation.requestBody && !entry.accepts_json_body) reason = "non-JSON request body";
    if (reason) {
      exclusions.push({ ...entry, reason });
      continue;
    }
    operations.push(entry);
  }
}

const modernProductOperations = [
  {
    operation_id: "ListProducts202610",
    api_version: "2026-10",
    method: "GET",
    path: "/api/2026-10/products",
    tag: "Products 2026-10",
    summary: "List products using the explicit product-family model",
    scopes: ["products:read", "products:read:costs"],
    path_parameters: [],
    query_parameters: ["after", "before", "page_size", "sku", "family_id", "active"],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "read",
    risk: "read_only",
    lifecycle: "preferred",
  },
  {
    operation_id: "GetProduct202610",
    api_version: "2026-10",
    method: "GET",
    path: "/api/2026-10/products/{product_id}",
    tag: "Products 2026-10",
    summary: "Get one product-family member",
    scopes: ["products:read", "products:read:costs"],
    path_parameters: ["product_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "read",
    risk: "read_only",
    lifecycle: "preferred",
  },
  {
    operation_id: "GetProductFamily202610",
    api_version: "2026-10",
    method: "GET",
    path: "/api/2026-10/product_families/{product_family_id}",
    tag: "Products 2026-10",
    summary: "Get an explicit standard, variant, or composite product family",
    scopes: ["products:read", "products:read:costs"],
    path_parameters: ["product_family_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "read",
    risk: "read_only",
    lifecycle: "preferred",
  },
  {
    operation_id: "GetProductFamilyForProduct202610",
    api_version: "2026-10",
    method: "GET",
    path: "/api/2026-10/products/{product_id}/family",
    tag: "Products 2026-10",
    summary: "Get the family for a product member",
    scopes: ["products:read", "products:read:costs"],
    path_parameters: ["product_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "read",
    risk: "read_only",
    lifecycle: "preferred",
  },
  {
    operation_id: "CreateProductFamily202610",
    api_version: "2026-10",
    method: "POST",
    path: "/api/2026-10/product_families",
    tag: "Products 2026-10",
    summary: "Create a standard, variant, or composite product family",
    scopes: ["products:write", "products:write:costs"],
    path_parameters: [],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: true,
    body_required: true,
    effect: "write",
    risk: "business_record_write",
    lifecycle: "preferred",
  },
  {
    operation_id: "AddProductToFamily202610",
    api_version: "2026-10",
    method: "POST",
    path: "/api/2026-10/product_families/{product_family_id}/products",
    tag: "Products 2026-10",
    summary: "Add a member to an existing product family",
    scopes: ["products:write", "products:write:costs"],
    path_parameters: ["product_family_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: true,
    body_required: true,
    effect: "write",
    risk: "business_record_write",
    lifecycle: "preferred",
  },
  {
    operation_id: "UpdateProductFamily202610",
    api_version: "2026-10",
    method: "PATCH",
    path: "/api/2026-10/product_families/{product_family_id}",
    tag: "Products 2026-10",
    summary: "Update family-level name, description, classification, channels, or component links",
    scopes: ["products:write", "products:write:costs"],
    path_parameters: ["product_family_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: true,
    body_required: true,
    effect: "write",
    risk: "business_record_write",
    lifecycle: "preferred",
  },
  {
    operation_id: "UpdateProduct202610",
    api_version: "2026-10",
    method: "PATCH",
    path: "/api/2026-10/products/{product_id}",
    tag: "Products 2026-10",
    summary: "Update member-level codes, prices, suppliers, measurements, taxes, or outlet inventory settings",
    scopes: ["products:write", "products:write:costs"],
    path_parameters: ["product_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: true,
    body_required: true,
    effect: "write",
    risk: "business_record_write",
    lifecycle: "preferred",
  },
  {
    operation_id: "DeleteProduct202610",
    api_version: "2026-10",
    method: "DELETE",
    path: "/api/2026-10/products/{product_id}",
    tag: "Products 2026-10",
    summary: "Delete one product-family member (irreversible)",
    scopes: ["products:write"],
    path_parameters: ["product_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "write",
    risk: "destructive",
    lifecycle: "preferred",
  },
  {
    operation_id: "DeleteProductFamily202610",
    api_version: "2026-10",
    method: "DELETE",
    path: "/api/2026-10/product_families/{product_family_id}",
    tag: "Products 2026-10",
    summary: "Delete a whole product family (irreversible)",
    scopes: ["products:write"],
    path_parameters: ["product_family_id"],
    query_parameters: [],
    required_query_parameters: [],
    accepts_json_body: false,
    body_required: false,
    effect: "write",
    risk: "destructive",
    lifecycle: "preferred",
  },
];

operations.push(...modernProductOperations);

const byPathAndMethod = new Map(operations.map((entry) => [`${entry.method} ${entry.path}`, entry]));
for (const entry of operations) {
  if (entry.effect !== "write") continue;
  const samePathGet = byPathAndMethod.get(`GET ${entry.path}`);
  // A collection GET is not deterministic verification for a create POST.
  // Automatic baselines are therefore limited to operations that mutate or
  // remove an already-addressable resource.
  if (samePathGet && ["PUT", "PATCH", "DELETE"].includes(entry.method)) {
    entry.baseline_operation_id = samePathGet.operation_id;
  }
  if (entry.operation_id === "UpdateProduct202610" || entry.operation_id === "DeleteProduct202610") {
    entry.baseline_operation_id = "GetProduct202610";
  }
  if (entry.operation_id === "UpdateProductFamily202610" || entry.operation_id === "DeleteProductFamily202610") {
    entry.baseline_operation_id = "GetProductFamily202610";
  }
  if (entry.operation_id === "AddProductToFamily202610") {
    entry.baseline_operation_id = "GetProductFamily202610";
  }
}

operations.sort((a, b) => a.operation_id.localeCompare(b.operation_id));
const catalog = Object.fromEntries(operations.map((entry) => [entry.operation_id, entry]));
const sourceHash = createHash("sha256").update(raw).digest("hex");
const generatedAt = new Date().toISOString();

const output = `// Generated by scripts/build-lightspeed-operation-registry.mjs. Do not hand-edit.\n` +
  `// Source: ${SOURCE_URL}\n` +
  `// Source SHA-256: ${sourceHash}\n` +
  `export const OPERATION_CATALOG_VERSION = ${JSON.stringify(spec.info?.version || "2026-07")};\n` +
  `export const OPERATION_CATALOG_SOURCE = ${JSON.stringify(SOURCE_URL)};\n` +
  `export const OPERATION_CATALOG_GENERATED_AT = ${JSON.stringify(generatedAt)};\n` +
  `export const OPERATION_CATALOG = Object.freeze(${JSON.stringify(catalog, null, 2)});\n` +
  `export const EXCLUDED_OPERATION_COUNT = ${exclusions.length};\n`;
writeFileSync(outputPath, output, "utf8");

const groups = new Map();
for (const operation of operations) {
  if (!groups.has(operation.tag)) groups.set(operation.tag, []);
  groups.get(operation.tag).push(operation);
}

const markdown = [
  "# Discount Furniture Lightspeed operation catalog",
  "",
  `Generated from Lightspeed API ${spec.info?.version || "2026-07"} plus the official 2026-10 Products migration contract.`,
  "",
  `- Implemented operations: ${operations.length}`,
  `- Read-only operations: ${operations.filter((entry) => entry.effect === "read").length}`,
  `- Preview-gated write operations: ${operations.filter((entry) => entry.effect === "write").length}`,
  `- Excluded source operations: ${exclusions.length}`,
  `- Source SHA-256: \`${sourceHash}\``,
  "",
  "Every write is exposed only through a signed, expiring preview receipt. The execute tool rechecks the baseline and reserves an audit record before calling Lightspeed.",
  "",
];
for (const [tag, entries] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  markdown.push(`## ${tag}`, "", "| Operation | Method | Effect | Risk | Required scopes |", "|---|---:|---|---|---|");
  for (const entry of entries.sort((a, b) => a.operation_id.localeCompare(b.operation_id))) {
    markdown.push(`| \`${entry.operation_id}\` | ${entry.method} | ${entry.effect} | ${entry.risk} | ${entry.scopes.join(", ") || "not documented"} |`);
  }
  markdown.push("");
}
markdown.push(
  "## Deliberate gaps",
  "",
  "- Product image upload remains specialized/browser-assisted because the API endpoint is multipart rather than JSON.",
  "- Card charging/refunding and receipt transmission are not implied by sale/payment record access.",
  "- Partner billing, security audit, primary-admin identity, business-rule, and remote-rule scopes are excluded.",
  "- Physical on-hand must not be conflated with `inventory_levels.current_inventory_level`, which Lightspeed documents as available-to-sell.",
  "",
);
writeFileSync(markdownPath, markdown.join("\n"), "utf8");

console.log(JSON.stringify({
  generated_at: generatedAt,
  source_sha256: sourceHash,
  implemented: operations.length,
  reads: operations.filter((entry) => entry.effect === "read").length,
  writes: operations.filter((entry) => entry.effect === "write").length,
  excluded: exclusions.length,
}, null, 2));
