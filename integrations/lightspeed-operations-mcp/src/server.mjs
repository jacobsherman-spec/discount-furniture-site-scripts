#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import * as z from "zod/v4";

import { FileAuditStore } from "./audit-store.mjs";
import { defaultAuditDirectory, loadProtectedCredential } from "./credential-loader.mjs";
import { LightspeedOperationsClient, OperationsError } from "./core.mjs";

const VERSION = "0.1.0";

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const operationInput = {
  operation_id: z.string().min(1).describe("Exact operation_id returned by lightspeed_capabilities"),
  path_parameters: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.union([scalar, z.array(scalar)])).optional(),
  body: z.any().optional(),
};

function responseFor(data, isError = false) {
  return {
    isError,
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

async function runTool(callback) {
  try {
    return responseFor(await callback());
  } catch (error) {
    const data = {
      ok: false,
      error: error?.message || String(error),
      status: error instanceof OperationsError ? error.status : 500,
      details: error instanceof OperationsError ? error.details : undefined,
      write_executed: Boolean(error?.writeExecuted),
      audit_id: error?.auditId || undefined,
    };
    return responseFor(data, true);
  }
}

function summarizeRetailer(data) {
  const value = data?.data || data;
  if (!value || typeof value !== "object") return null;
  return {
    id: value.id ?? null,
    name: value.name ?? value.display_name ?? null,
    domain_prefix: value.domain_prefix ?? value.domain ?? null,
    currency: value.currency ?? value.currency_code ?? null,
    time_zone: value.time_zone ?? value.timezone ?? null,
  };
}

export async function createOperationsClientFromEnvironment(environment = process.env) {
  const auditDirectory = environment.DF_LIGHTSPEED_AUDIT_DIR || defaultAuditDirectory(environment);
  const credential = await loadProtectedCredential(environment);
  return new LightspeedOperationsClient({
    domainPrefix: credential?.retailer_domain_prefix || environment.DF_LIGHTSPEED_DOMAIN_PREFIX || "discountfurniture",
    token: credential?.token || "",
    signingKey: credential?.signing_key || "",
    auditStore: auditDirectory ? new FileAuditStore(auditDirectory) : null,
    writesEnabled: String(environment.DF_LIGHTSPEED_WRITES_ENABLED || "false").toLowerCase() === "true",
  });
}

export function createMcpServer(client) {
  const server = new McpServer(
    { name: "discount-furniture-lightspeed-operations", version: VERSION },
    {
      instructions: [
        "This server connects directly to Discount Furniture's Lightspeed X-Series retailer API.",
        "Tool availability is capability, not user authorization. Execute a write only when the human explicitly requested that exact business change in the current task.",
        "Always use lightspeed_preview_change before lightspeed_execute_change and preserve the signed preview receipt unchanged.",
        "Reload/verify saved records. A successful request alone is not completion proof.",
        "Inventory levels are available-to-sell, not physical on-hand. Use Inventory records for physical stock facts.",
        "Do not combine composite parent and component quantities. Confirm exact product/SKU, outlet, customer, sale, or purchase order identity before any write.",
        "Payment record access does not charge or refund a card, and this adapter does not transmit receipts or customer messages.",
      ].join(" "),
    },
  );

  server.registerTool("lightspeed_connection_status", {
    title: "Check Lightspeed connection",
    description: "Check whether the local credential is configured and, when it is, perform one safe retailer read. Never returns the token.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => runTool(async () => {
    if (!client.token) {
      return {
        ok: false,
        configured: false,
        domain: `${client.domainPrefix}.retail.lightspeed.app`,
        next_action: "Run configure-credential.ps1 and paste the token into its hidden local prompt",
      };
    }
    const read = await client.read({ operation_id: "GetRetailer" });
    return {
      ok: read.result.ok,
      configured: true,
      domain: `${client.domainPrefix}.retail.lightspeed.app`,
      http_status: read.result.status,
      retailer: summarizeRetailer(read.result.data),
      rate_limit: {
        limit: read.result.headers["x-ratelimit-limit"] || null,
        remaining: read.result.headers["x-ratelimit-remaining"] || null,
        reset: read.result.headers["x-ratelimit-reset"] || null,
      },
    };
  }));

  server.registerTool("lightspeed_capabilities", {
    title: "List Lightspeed capabilities",
    description: "List or search the fixed allowlisted Lightspeed operation catalog. Use this before selecting an operation_id.",
    inputSchema: {
      effect: z.enum(["read", "write"]).optional(),
      tag: z.string().optional(),
      search: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (args) => runTool(async () => client.capabilities(args)));

  server.registerTool("lightspeed_read", {
    title: "Read Lightspeed",
    description: "Execute one allowlisted read operation. Supports GET and documented read-only POST operations; it cannot call arbitrary URLs.",
    inputSchema: operationInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => runTool(async () => client.read(args)));

  server.registerTool("lightspeed_preview_change", {
    title: "Preview a Lightspeed change",
    description: "Create a signed 15-minute preview for one allowlisted write. It performs baseline reads only and never writes business data.",
    inputSchema: operationInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async (args) => runTool(async () => client.preview(args)));

  server.registerTool("lightspeed_execute_change", {
    title: "Execute an authorized Lightspeed change",
    description: "Execute the exact request in a fresh signed preview receipt. Call only after the current human user explicitly requested that specific business change. The tool rechecks its baseline and reserves a non-repeatable audit record first.",
    inputSchema: {
      preview_receipt: z.string().min(20),
      approved: z.literal(true),
      approved_by: z.string().min(2),
      approval_note: z.string().min(8),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async (args) => runTool(async () => client.execute(args)));

  server.registerTool("lightspeed_verify_change", {
    title: "Verify a Lightspeed change",
    description: "Reload the deterministic baseline resource associated with a signed preview and report whether it changed. Works after preview expiry; it does not write.",
    inputSchema: { preview_receipt: z.string().min(20) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async (args) => runTool(async () => client.verify(args)));

  return server;
}

export async function main() {
  const client = await createOperationsClientFromEnvironment();
  const server = createMcpServer(client);
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Discount Furniture Lightspeed MCP failed: ${error?.message || String(error)}`);
    process.exit(1);
  });
}
