#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const workflowPath = resolve(repositoryRoot, ".github", "workflows", "lightspeed-operations-mcp.yml");
const rootReadmePath = resolve(repositoryRoot, "README.md");
const allowedExtensions = new Set([".js", ".json", ".md", ".mjs", ".ps1", ".toml", ".yaml", ".yml"]);
const skippedDirectories = new Set([".git", "dist", "node_modules"]);
const skippedFiles = new Set(["pnpm-lock.yaml"]);

function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (skippedDirectories.has(name)) continue;
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (allowedExtensions.has(extname(name)) && !skippedFiles.has(name)) files.push(path);
  }
  return files;
}

function walkAll(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (skippedDirectories.has(name)) continue;
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...walkAll(path));
    else files.push(path);
  }
  return files;
}

const files = [...walk(packageRoot), rootReadmePath];
if (existsSync(workflowPath)) files.push(workflowPath);

const forbiddenFileNames = [
  /^credential\.dpapi$/i,
  /^\.env(?:\..+)?$/i,
  /^(?:token|credentials?)\.(?:json|txt)$/i,
  /\.(?:p12|pem|pfx)$/i,
  /^id_(?:ed25519|rsa)$/i,
];
const trackedResult = spawnSync("git", ["ls-files", "-z"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
if (trackedResult.status !== 0) {
  throw new Error("unable to enumerate tracked files: " + (trackedResult.stderr || trackedResult.stdout));
}
const trackedFiles = trackedResult.stdout
  .split("\0")
  .filter(Boolean)
  .map((path) => resolve(repositoryRoot, path));
const namedFileCandidates = new Set([...walkAll(packageRoot), ...trackedFiles]);
for (const path of namedFileCandidates) {
  const name = path.split(/[\\/]/).at(-1);
  if (forbiddenFileNames.some((pattern) => pattern.test(name))) {
    throw new Error(`credential-like file must not be committed: ${relative(repositoryRoot, path)}`);
  }
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /["']Authorization["']\s*:\s*["']Bearer\s+[A-Za-z0-9._-]{20,}["']/i,
  /\b(?:DF_LIGHTSPEED_TOKEN|LS_TOKEN|LS_API_TOKEN|GITHUB_TOKEN|FACADE_API_KEY|BRIDGE_API_KEY)\s*=\s*["']?[A-Za-z0-9._-]{20,}["']?/i,
  /https?:\/\/[^\s)]+[?&](?:access_token|api_key|sig|token)=[A-Za-z0-9%._~-]{16,}/i,
];

for (const path of files) {
  const text = readFileSync(path, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) throw new Error(`possible plaintext secret in ${relative(repositoryRoot, path)} (${pattern})`);
  }
  if (/C:\\Users\\[^\\\s]+/i.test(text)) {
    throw new Error(`machine-specific user path in ${relative(repositoryRoot, path)}`);
  }
}

const markdownFiles = files.filter((path) => extname(path).toLowerCase() === ".md");
const brokenLinks = [];
for (const path of markdownFiles) {
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "");
    target = target.split(/\s+["']/)[0];
    if (!target || /^(?:https?:|mailto:|#|codex:)/i.test(target)) continue;
    const fileTarget = decodeURIComponent(target.split("#")[0].split("?")[0]);
    if (fileTarget && !existsSync(resolve(dirname(path), fileTarget))) {
      brokenLinks.push(`${relative(repositoryRoot, path)} -> ${target}`);
    }
  }
}
if (brokenLinks.length) throw new Error(`broken relative Markdown links:\n${brokenLinks.join("\n")}`);

console.log(JSON.stringify({
  ok: true,
  scanned_files: files.length,
  tracked_file_names: trackedFiles.length,
  markdown_files: markdownFiles.length,
  scope: "connector, connector workflow, and root README",
}, null, 2));
