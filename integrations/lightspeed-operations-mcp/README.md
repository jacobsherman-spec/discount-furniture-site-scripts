# Discount Furniture Lightspeed Operations MCP

Direct local Codex-to-Lightspeed X-Series integration for Discount Furniture. It does not depend on Cloudflare and does not change the existing Discount Furniture Builder deployment.

## What is implemented

- Local stdio MCP server registered as `discount-furniture-lightspeed`.
- Fixed catalog generated from Lightspeed's official 2026-07 OpenAPI specification, plus the official 2026-10 product-family migration surface.
- 201 allowlisted operations: 107 reads and 94 writes.
- Six MCP tools: connection status, capability search, read, write preview, write execution, and verification.
- Hidden one-time token capture with Windows DPAPI encryption for the current Windows user.
- Runtime DPAPI decryption through a private one-use Windows named pipe. Secret material is never placed on stdout, in MCP messages, command arguments, source, logs, reports, or plaintext configuration.
- Signed 15-minute previews, exact request hashing, fresh baseline checks, exclusive local audit reservation, replay prevention, and exact requested-state reload verification.

Tool availability is not authorization. A write is valid only when Jacob explicitly requested the exact underlying business change in the current task.

## Local paths

- Installed server: `%LOCALAPPDATA%\DiscountFurniture\lightspeed-ops\app\server.mjs`
- Encrypted credential: `%LOCALAPPDATA%\DiscountFurniture\lightspeed-ops\credential.dpapi`
- Audit receipts: `%LOCALAPPDATA%\DiscountFurniture\lightspeed-ops\audit\`
- Credential capture: `%LOCALAPPDATA%\DiscountFurniture\lightspeed-ops\app\configure-credential.ps1`

The credential file is a DPAPI ciphertext bound to the current Windows user. Do not commit or copy it to another computer.

## Secure credential setup

Use the separate private app **Discount Furniture Local Operations**. Do not generate or rotate a token on the existing Builder app because Lightspeed's UI does not prove that an older token will remain valid.

Run the installed capture script in an interactive PowerShell window. It prompts once with hidden input:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DiscountFurniture\lightspeed-ops\app\configure-credential.ps1"
```

Paste the one-time token directly into that local prompt and press Enter. Never paste it into chat.

## Build, test, and install

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
node .\scripts\list-tools.mjs --installed
```

Register the installed server with Codex:

```powershell
codex mcp add discount-furniture-lightspeed --env DF_LIGHTSPEED_WRITES_ENABLED=false -- node.exe "$env:LOCALAPPDATA\DiscountFurniture\lightspeed-ops\app\server.mjs"
```

Read-only is the default registration. Enabling the runtime write gate is a separate supervised maintenance action; it still does not authorize a business write. Codex loads MCP servers when a task starts, so open a new task or reload the app after a registration change before relying on the six-tool inventory or reported gate state.

## Safety and interpretation rules

- `inventory_levels.current_inventory_level` is available-to-sell, not physical on-hand.
- Use Inventory records for physical stock facts. Never add composite-parent quantities to component quantities.
- Verify exact SKU/product, outlet, customer, sale, or purchase-order identity before a write.
- Price/cost work must use the documented cost scopes and reload the saved product or supplier record.
- A successful HTTP response is not sufficient completion proof. Reload and compare the intended fields/counts.
- Create operations without a deterministic resource URL return `verification_required`; follow with a targeted read using the returned identifier.
- Sales/payment record access does not charge or refund a card.
- Customer messaging and receipt transmission are not implemented.

## Deliberate API/browser boundaries

- Product image upload remains specialized because Lightspeed exposes multipart upload rather than the JSON adapter used here.
- eCom/channel reads do not prove that publication writes are supported; use a verified API endpoint or browser fallback for publication changes.
- Card processing/refunds and receipt/customer-message delivery require their own supported workflows and are not inferred from record access.
- Browser fallback should be used only for a business action the API cannot perform or cannot verify safely.

See [CAPABILITIES.md](./CAPABILITIES.md) for the generated operation list, [STATUS.md](./STATUS.md) for implemented, live-tested, mock-tested, and browser-only boundaries, [VERIFICATION.md](./VERIFICATION.md) for the conservative exact-state contract, and [SKILL-INTEGRATION.md](./SKILL-INTEGRATION.md) for catalog, monthly-statement, and QuickBooks-reconciliation routing.

Additional operating references:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system surfaces, trust boundaries, and release model
- [RECOVERY.md](./RECOVERY.md) — availability recovery and safe local-app token rotation
- [TOKEN-SCOPE-MAP.md](./TOKEN-SCOPE-MAP.md) — future read-mostly automation credential and supervised high-impact scopes

## Release checks

Run the connector tests and build, then the repository release checks:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
node .\scripts\release-check.mjs --require-build
node .\scripts\list-tools.mjs --no-credential
pnpm audit --prod --audit-level=high
```

`release-check.mjs` verifies the generated registry's pinned source hash/counts, relative documentation links, and connector-focused secret/path hygiene. In the local project workspace it also discovers the pinned OpenAPI JSON snapshot in the sibling `specs` folder and performs a full normalized regeneration. In another checkout, pass the exact snapshot explicitly:

```powershell
node .\scripts\release-check.mjs --require-build --spec <path-to-lightspeed-api-2026-07.json>
```

CI intentionally runs without a live token and never performs a business read or write.

## Registry regeneration

From the repository root, with an official OpenAPI JSON file:

```powershell
node scripts\build-lightspeed-operation-registry.mjs <openapi.json> integrations\lightspeed-operations-mcp\src\operations-registry.js integrations\lightspeed-operations-mcp\CAPABILITIES.md
```

The generated file records the official source URL and SHA-256 of the input specification.
