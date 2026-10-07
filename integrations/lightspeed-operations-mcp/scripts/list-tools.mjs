#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { resolve } from "node:path";

const serverPath = resolve("dist/server.mjs");
const client = new Client({ name: "discount-furniture-mcp-smoke-test", version: "0.1.0" });
const installed = process.argv.includes("--installed");
const transport = installed
  ? new StdioClientTransport({
      command: process.execPath,
      args: [join(process.env.LOCALAPPDATA, "DiscountFurniture", "lightspeed-ops", "app", "server.mjs")],
      env: { ...process.env, DF_LIGHTSPEED_WRITES_ENABLED: "true" },
      stderr: "pipe",
    })
  : new StdioClientTransport({ command: process.execPath, args: [serverPath] });

try {
  transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  await client.connect(transport);
  const listed = await client.listTools();
  const status = await client.callTool({ name: "lightspeed_connection_status", arguments: {} });
  const structured = status.structuredContent || {};
  console.log(JSON.stringify({
    tool_names: listed.tools.map((tool) => tool.name),
    connection_configured: Boolean(structured.configured),
    domain: structured.domain || null,
  }, null, 2));
} finally {
  await client.close();
}
