#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";

const installedServer = join(process.env.LOCALAPPDATA, "DiscountFurniture", "lightspeed-ops", "app", "server.mjs");
const client = new Client({ name: "discount-furniture-live-read-check", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [installedServer],
  env: { ...process.env, DF_LIGHTSPEED_WRITES_ENABLED: "false" },
  stderr: "pipe",
});

function structured(response) {
  return response.structuredContent || {};
}

function firstRecord(value) {
  if (Array.isArray(value)) return value.find((entry) => entry && typeof entry === "object") || null;
  if (!value || typeof value !== "object") return null;
  for (const key of ["data", "products", "items", "results", "records"]) {
    const found = firstRecord(value[key]);
    if (found) return found;
  }
  return null;
}

function arrayCount(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return null;
  for (const key of ["data", "products", "items", "results", "records"]) {
    if (Array.isArray(value[key])) return value[key].length;
  }
  return null;
}

function keysMatching(value, pattern, depth = 0, output = new Set()) {
  if (!value || typeof value !== "object" || depth > 4) return output;
  for (const [key, child] of Object.entries(value)) {
    if (pattern.test(key)) output.add(key);
    if (typeof child === "object") keysMatching(child, pattern, depth + 1, output);
  }
  return output;
}

async function call(name, args = {}) {
  return structured(await client.callTool({ name, arguments: args }));
}

async function read(operation_id, options = {}) {
  const response = await call("lightspeed_read", { operation_id, ...options });
  const result = response.result || {};
  return {
    response,
    summary: {
      operation_id,
      ok: Boolean(result.ok),
      http_status: result.status ?? response.status ?? null,
      item_count_in_page: arrayCount(result.data),
      rate_limit_remaining: result.headers?.["x-ratelimit-remaining"] ?? null,
      error: response.error || null,
    },
  };
}

try {
  await client.connect(transport);
  const status = await call("lightspeed_connection_status");
  const summaries = [{
    operation_id: "connection_status",
    ok: Boolean(status.ok),
    configured: Boolean(status.configured),
    http_status: status.http_status ?? null,
    domain: status.domain ?? null,
  }];
  if (!status.configured || !status.ok) {
    console.log(JSON.stringify({ safe_read_check: "blocked", summaries }, null, 2));
    process.exitCode = 2;
  } else {
    const productList = await read("ListProducts", { query: { page_size: 1 } });
    summaries.push(productList.summary);
    const product = firstRecord(productList.response.result?.data);

    for (const [operation_id, query] of [
      ["ListSuppliers", { page_size: 1 }],
      ["ListCustomers", { page_size: 1 }],
      ["ListSales", { page_size: 1 }],
      ["ListPurchaseOrders", { page_size: 1 }],
      ["ListOutlets", { page_size: 1 }],
      ["ListServices", { limit: 1 }],
      ["ListProducts202610", { page_size: 1 }],
      ["get-webhooks", {}],
    ]) {
      summaries.push((await read(operation_id, { query })).summary);
    }

    for (const [operation_id, body] of [
      ["ListInventoryRecords", { size: 1 }],
      ["ListInventoryLevels", { size: 1 }],
    ]) {
      const inventoryRead = await read(operation_id, { body });
      inventoryRead.summary.cost_field_names_present = [
        ...keysMatching(inventoryRead.response.result?.data, /cost|supplier_price|supply_price/i),
      ].sort();
      summaries.push(inventoryRead.summary);
    }

    if (product?.id) {
      const productDetail = await read("GetProductByID", { path_parameters: { product_id: String(product.id) } });
      const costFields = [...keysMatching(productDetail.response.result?.data, /cost|supplier_price|supply_price/i)].sort();
      productDetail.summary.cost_field_names_present = costFields;
      summaries.push(productDetail.summary);
      summaries.push((await read("ListProductInventoryRecords", {
        path_parameters: { product_id: String(product.id) },
        query: { page_size: 1 },
      })).summary);
      summaries.push((await read("ListProductInventoryLevels", {
        path_parameters: { product_id: String(product.id) },
      })).summary);
      summaries.push((await read("GetProductFamilyForProduct202610", {
        path_parameters: { product_id: String(product.id) },
      })).summary);

      if (product.sku) {
        const preview = await call("lightspeed_preview_change", {
          operation_id: "UpdateProduct202610",
          path_parameters: { product_id: String(product.id) },
          body: { sku: String(product.sku) },
        });
        const verification = preview.preview_receipt
          ? await call("lightspeed_verify_change", { preview_receipt: preview.preview_receipt })
          : null;
        summaries.push({
          operation_id: "live_signed_preview_and_verify",
          ok: Boolean(preview.ok) && preview.write_executed === false && Boolean(preview.baseline?.response?.ok) && verification?.changed_since_preview === false,
          write_executed: Boolean(preview.write_executed),
          baseline_http_status: preview.baseline?.response?.status ?? null,
          changed_since_preview: verification?.changed_since_preview ?? null,
          receipt_value_reported: false,
        });
      }
    } else {
      summaries.push({ operation_id: "product-dependent reads", ok: false, skipped: "No product ID found in the one-item page" });
    }

    console.log(JSON.stringify({
      safe_read_check: summaries.every((entry) => entry.ok || entry.skipped) ? "passed" : "partial",
      note: "Only status, page counts, rate-limit metadata, and field names are reported; record values are intentionally omitted.",
      summaries,
    }, null, 2));
  }
} finally {
  await client.close();
}
