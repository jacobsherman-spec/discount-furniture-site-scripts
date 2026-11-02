# Discount Furniture site assets and operations integrations

This repository contains versioned Lightspeed E-Series storefront assets, brand templates and media, legacy/manual Cloudflare Worker implementations, and the direct local Lightspeed operations connector used by Codex.

## Operational status

- The **Discount Furniture Lightspeed Operations MCP** is a local Windows integration. It does not depend on Cloudflare; start with [its README](./integrations/lightspeed-operations-mcp/README.md).
- The existing deployed **Discount Furniture Builder** is not retired or replaced by the local connector. Its app, token, Worker routes, and live deployment must be treated as a separate system.
- Repository contents do not prove which storefront scripts or Cloudflare Workers are currently deployed. Storefront/Worker publishing is manual and requires an independent live-route check.
- `worker/worker.js` is a legacy proxy example with a placeholder origin. `workers/internal-bridge` still documents a placeholder D1 database ID. Do not deploy either as-is.

## Repository map

```text
/brand-templates                 maintained manufacturer description templates
/media                           approved product and brand assets
/scripts                         storefront scripts and registry generator
/styles                          storefront CSS
/snippets                        historical/loader snippets; verify URLs before use
/worker                          legacy storefront proxy example
/workers/gpt-facade              legacy/manual GPT-facing Cloudflare Worker
/workers/internal-bridge         legacy/manual internal Cloudflare bridge
/integrations/lightspeed-operations-mcp
  README.md                      local connector setup and checks
  ARCHITECTURE.md                system and authorization boundaries
  RECOVERY.md                    recovery and safe token rotation
  TOKEN-SCOPE-MAP.md             read-mostly and high-impact scope guidance
```

## Local Lightspeed connector

The connector exposes a fixed official-source operation catalog through six local MCP tools. It protects its credential with Windows DPAPI, gates writes behind signed expiring previews, blocks replay and baseline drift, and requires saved-record verification.

From `integrations/lightspeed-operations-mcp`:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
node .\scripts\release-check.mjs --require-build
```

Installation, credential capture, MCP registration, and safety rules are documented in the [connector README](./integrations/lightspeed-operations-mcp/README.md). Tool availability is capability, not permission to change a business record.

## Storefront assets

The storefront files are source assets, not an automatic deployment pipeline. Before publishing a script, style, loader, template, or media file:

1. Identify the exact live page or product and its current asset URL.
2. Confirm the repository source and intended live version match.
3. Review mobile and desktop behavior.
4. Publish through the verified current route.
5. Reload the public storefront and retain live proof.

Some historical loader snippets reference filenames or Worker URLs that may no longer match the maintained source files. Do not copy a snippet into Lightspeed until its target exists at the verified live origin.

## Cloudflare Workers

Worker directories remain for continuity and investigation. Their presence does not establish deployment status or readiness:

- `worker/` is a placeholder-origin storefront proxy example.
- `workers/gpt-facade/` documents a protected facade design.
- `workers/internal-bridge/` documents an earlier Lightspeed/GitHub bridge and is not ready for deployment with the checked-in placeholder D1 setting.

Any Worker deployment, secret change, route change, migration, or retirement requires a separate task with current Cloudflare and live-endpoint verification. Local connector work must not redeploy or disable the existing Builder.

## Security and release rules

- Never commit Lightspeed, GitHub, Cloudflare, facade, bridge, or other bearer credentials.
- Keep the DPAPI credential and connector audit directory under `%LOCALAPPDATA%`, outside the repository.
- Do not put customer records, financial source documents, signed write receipts, or statement packets in GitHub.
- The connector CI uses Windows, Node 22, a frozen pnpm lockfile, registry/hash checks, a local no-credential MCP smoke test, link/secret sanity checks, and a production dependency audit.
- A successful build, preview, API response, import, or UI toast is not saved-result proof.

© Discount Furniture. MIT License for general code; see [LICENSE](./LICENSE).
