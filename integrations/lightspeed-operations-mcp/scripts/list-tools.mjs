#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const serverPath = resolve("dist/server.mjs");
const client = new Client({ name: "discount-furniture-mcp-smoke-test", version: "0.1.0" });
const installed = process.argv.includes("--installed");
const noCredential = process.argv.includes("--no-credential");
const childEnvironment = {
  ...process.env,
  DF_LIGHTSPEED_WRITES_ENABLED: "false",
  ...(noCredential
    ? {
        DF_LIGHTSPEED_CREDENTIAL_PATH: join(
          tmpdir(),
          "df-lightspeed-no-credential",
          `${process.pid}-${Date.now()}.dpapi`,
        ),
      }
    : {}),
};
const transport = installed
  ? new StdioClientTransport({
      command: process.execPath,
      args: [join(process.env.LOCALAPPDATA, "DiscountFurniture", "lightspeed-ops", "app", "server.mjs")],
      env: childEnvironment,
      stderr: "pipe",
    })
  : new StdioClientTransport({ command: process.execPath, args: [serverPath], env: childEnvironment });

try {
  transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  await client.connect(transport);
  const listed = await client.listTools();
  const status = await client.callTool({ name: "lightspeed_connection_status", arguments: {} });
  const structured = status.structuredContent || {};
  const expectedTools = ["lightspeed_connection_status", "lightspeed_capabilities", "lightspeed_read", "lightspeed_preview_change", "lightspeed_execute_change", "lightspeed_verify_change"];
  if (listed.tools.map((tool) => tool.name).sort().join("|") !== expectedTools.sort().join("|")) {
    throw new Error("Installed MCP tool set differs from the six expected operations tools");
  }
  if (status.isError || !structured.runtime?.executable_sha256 || structured.runtime.writes_enabled !== false) {
    throw new Error("Read-only smoke status failed or omitted runtime identity");
  }
  if (noCredential && structured.configured !== false) {
    throw new Error("No-credential smoke unexpectedly loaded a credential");
  }
  console.log(JSON.stringify({
    tool_names: listed.tools.map((tool) => tool.name),
    connection_configured: Boolean(structured.configured),
    domain: structured.domain || null,
    runtime: structured.runtime || null,
    connection: {
      ok: Boolean(structured.ok),
      configured: Boolean(structured.configured),
      http_status: structured.http_status ?? null,
      domain: structured.domain || null,
      runtime: structured.runtime || null,
    },
  }, null, 2));
} finally {
  await client.close();
}
