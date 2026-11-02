import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

function localAppData(environment) {
  return environment.LOCALAPPDATA || join(homedir(), "AppData", "Local");
}

function helperPath(environment) {
  if (environment.DF_LIGHTSPEED_CREDENTIAL_HELPER) return environment.DF_LIGHTSPEED_CREDENTIAL_HELPER;
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDirectory, "read-credential.ps1"),
    join(moduleDirectory, "..", "scripts", "read-credential.ps1"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

export function defaultCredentialPath(environment = process.env) {
  return join(localAppData(environment), "DiscountFurniture", "lightspeed-ops", "credential.dpapi");
}

export function defaultAuditDirectory(environment = process.env) {
  return join(localAppData(environment), "DiscountFurniture", "lightspeed-ops", "audit");
}

export async function loadProtectedCredential(environment = process.env) {
  if (environment.DF_LIGHTSPEED_TOKEN) {
    throw new Error("Plaintext environment credentials are disabled. Remove DF_LIGHTSPEED_TOKEN and use the protected Windows credential.");
  }

  const credentialPath = environment.DF_LIGHTSPEED_CREDENTIAL_PATH || defaultCredentialPath(environment);
  if (!existsSync(credentialPath)) return null;
  const helper = helperPath(environment);
  if (!existsSync(helper)) throw new Error("The DPAPI credential helper is missing from the local MCP installation");

  const pipeName = `df-lightspeed-${process.pid}-${randomUUID()}`;
  const pipePath = `\\\\.\\pipe\\${pipeName}`;
  const chunks = [];
  let byteCount = 0;
  let accepted = false;

  const server = createServer((socket) => {
    if (accepted) {
      socket.destroy();
      return;
    }
    accepted = true;
    socket.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > 64 * 1024) {
        socket.destroy(new Error("Protected credential payload is unexpectedly large"));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(pipePath, resolve);
  });

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    helper,
    "-CredentialPath",
    credentialPath,
    "-PipeName",
    pipeName,
  ], {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 4096) stderr += chunk.toString("utf8");
  });

  const timeout = setTimeout(() => child.kill(), 15_000);
  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (exitCode !== 0) throw new Error(`DPAPI credential helper failed${stderr ? `: ${stderr.trim()}` : ""}`);
  } finally {
    clearTimeout(timeout);
    await new Promise((resolve) => server.close(resolve));
  }

  const bytes = Buffer.concat(chunks);
  try {
    const bundle = JSON.parse(bytes.toString("utf8"));
    if (bundle.version !== 1 || !bundle.token || !bundle.signing_key || !bundle.retailer_domain_prefix) {
      throw new Error("The protected credential has an unsupported or incomplete format");
    }
    return { ...bundle, source: "windows-dpapi" };
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}
