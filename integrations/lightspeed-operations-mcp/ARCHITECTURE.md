# Architecture and trust boundaries

The local Lightspeed connector is one component in Discount Furniture's operating environment. It is intentionally separate from storefront asset delivery, the existing Builder integration, QuickBooks, and the private workflow-skill suite.

```text
User task and selected workflow skill
                |
                v
   six fixed MCP tools over local stdio
                |
                v
 allowlisted operation registry + safety core
       |                    |
       v                    v
Lightspeed X-Series    local audit receipts
       ^
       |
DPAPI credential -> private one-use named pipe
```

## Repository surfaces

| Surface | Purpose | Deployment statement |
|---|---|---|
| `integrations/lightspeed-operations-mcp/` | Local Codex-to-Lightspeed MCP server | Installed manually on the Windows user account. It is not a Cloudflare deployment. |
| `scripts/`, `styles/`, `snippets/`, `media/`, `brand-templates/` | Storefront assets and catalog templates | Publishing is a separate, manual workflow. Repository presence does not prove the live storefront version. |
| `worker/` | Legacy/example storefront proxy | Contains a placeholder origin. Treat as an example until its live route and deployment are independently verified. |
| `workers/gpt-facade/` and `workers/internal-bridge/` | Earlier Cloudflare Builder/bridge implementation | Deployment state is not established by this repository. The internal bridge still documents a placeholder D1 ID. Do not deploy, disable, or retire either Worker from connector work. |
| Installed/private workflow skills | Catalog, statements, reconciliation, and orchestration rules | Maintained separately from this repository. [SKILL-INTEGRATION.md](./SKILL-INTEGRATION.md) records the public connector contract, not the authoritative skill source. |

The existing deployed **Discount Furniture Builder** is not retired by this connector. Its app, token, Worker, routes, and production status must be handled as a separate system until a deliberate migration is authorized and verified.

## Connector layers

1. **MCP surface** — six tools expose connection status, capability discovery, reads, preview, execution, and verification. There is no arbitrary URL proxy.
2. **Operation registry** — the generated catalog fixes method, path, parameters, scopes, effect, risk, and verification metadata for every exposed operation.
3. **Safety core** — write previews are signed and expire; execution checks the exact request hash, current baseline, drift, replay reservation, write gate, and audit path.
4. **Credential loader** — the token and local signing key are DPAPI-encrypted for the current Windows user and transferred to Node through a private one-use named pipe.
5. **Audit store** — consequential execution reserves a local record before the remote call. A response still requires a fresh business-record reload.

## Authorization model

These are separate decisions:

- **Private-app scope** says what the token could request from Lightspeed.
- **Registry coverage** says which fixed operations this server exposes.
- **Runtime write gate** says whether this process may execute a write at all.
- **Current-task authorization** says whether the user requested this exact business change.
- **Workflow proof** says whether the source evidence, identity, saved reload, export, or storefront checks establish completion.

All five must align for a write. A healthy connection, approved scope, operation match, or signed preview never substitutes for user authorization or saved-result proof.

## Read-mostly automation

Unattended collection should use a separate least-privilege, read-mostly credential when Lightspeed app management permits it, with the runtime write gate disabled. The supervised operations credential currently has broader approved scopes and should not be silently reused for scheduled jobs. See [TOKEN-SCOPE-MAP.md](./TOKEN-SCOPE-MAP.md).

Scheduled reads may prepare exception queues. They must not turn uncertain deposits, returns, inventory differences, customer balances, receipts, or historical accounting holds into writes.

## Release and reproducibility

The connector workflow runs on Windows with Node 22 and a frozen pnpm lockfile. It checks syntax/tests, builds the bundle, verifies the pinned operation-registry source hash and counts, scans connector release files for credential-like material and broken relative links, smoke-tests the six-tool MCP surface without credentials, and audits production dependencies.

The source OpenAPI snapshot is intentionally not committed. `scripts/check-registry-reproducibility.mjs` performs a full normalized regeneration when given the pinned JSON snapshot through `--spec` or `LIGHTSPEED_OPENAPI_SPEC`; CI performs the hash/count consistency check. Generated timestamps are the only normalized field.

See [RECOVERY.md](./RECOVERY.md) for failure handling and [STATUS.md](./STATUS.md) for the dated live-versus-mock test boundary.
