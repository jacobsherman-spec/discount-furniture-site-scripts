# Recovery and credential rotation

Use this runbook for connector availability, credential, preview, audit, or installed-bundle failures. It does not authorize a Lightspeed business write.

## First response

1. Stop the affected workflow before retrying a write.
2. Preserve its checkpoint, exact record IDs, baseline, and error text.
3. Do not paste a token, DPAPI file, signing key, signed preview receipt, or customer/financial payload into chat, logs, GitHub, or a command argument.
4. Do not rotate or modify the existing **Discount Furniture Builder** app or token. The local connector uses the separate **Discount Furniture Local Operations** private app.

## Tools are missing in Codex

- Confirm the MCP registration exists and points to the installed local bundle.
- Start a new task or reload Codex; MCP registrations are loaded when a task starts.
- Run the installed smoke test from a trusted source checkout:

```powershell
node .\scripts\list-tools.mjs --installed
```

The expected result is exactly six tool names. An unconfigured connection is acceptable for a tool-list smoke test; it is not acceptable for live reads.

## Credential is missing, rejected, or bound to another user

The protected file is tied to the Windows user through DPAPI. Copying it to another user or computer is not a recovery method.

For first-time capture, run the installed prompt and paste the token only into its hidden input:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DiscountFurniture\lightspeed-ops\app\configure-credential.ps1"
```

Then reload Codex and call `lightspeed_connection_status`. Confirm the returned retailer name, domain, and time zone before using any business operation.

## Intentional token rotation

Rotate only when the **Discount Furniture Local Operations** token is intentionally replaced or revoked.

1. Generate the replacement on that private app, not the Builder app.
2. Close the token dialog after capture; never record the value in a file or chat.
3. Replace the local DPAPI bundle atomically:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DiscountFurniture\lightspeed-ops\app\configure-credential.ps1" -Replace
```

4. Reload Codex and run `lightspeed_connection_status`.
5. Perform a safe exact read. Do not use a business write as a connection test.

The capture script writes a protected temporary file before replacement. If capture or encryption fails before the move, the existing protected credential remains in place.

## Wrong retailer or unexpected identity

Stop immediately and do not preview or execute a change. Verify the private app's organization, token, and configured domain prefix outside the business workflow. Replace the local credential only after the correct source is established, then repeat the connection and safe-read checks.

## Preview failure

| Condition | Required response |
|---|---|
| Expired receipt | Re-read the exact record and create a new preview. |
| Baseline drift | Reconcile the new state and re-plan; never force the old request. |
| Tamper or request-hash mismatch | Discard the receipt and investigate the caller or payload construction. |
| Replay rejection | Verify the prior audit/result. Do not reuse or manually edit the receipt. |
| Verification required | Keep the item open and perform the targeted API read, fresh export, or browser reload required by the workflow. |

## Audit reservation or disk failure

Do not bypass the audit store or manually mark a receipt unused. Check free space and current-user access to:

```text
%LOCALAPPDATA%\DiscountFurniture\lightspeed-ops\audit\
```

Preserve existing audit files. Reinstalling the application bundle does not require deleting the audit directory or credential.

## Rebuild or restore the installed bundle

From a trusted source checkout:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
node .\scripts\release-check.mjs --require-build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1
node .\scripts\list-tools.mjs --installed
```

The installer replaces application files only; it does not copy or change the protected credential. It returns the exact `previous_release` backup path when an older app was present. To restore that complete snapshot without rebuilding it, pass that exact sibling path back to the installer:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local.ps1 -RollbackTo "<exact app-backup-* path returned by the prior install>"
```

Do not guess a rollback path, reset a dirty source tree, or delete the backup until the replacement has passed its checks.

After install or rollback, compare `lightspeed_connection_status.runtime` with the installed `installation.json`:

- runtime `connector_version` must equal manifest `connector_version`;
- runtime `executable_sha256` must equal manifest `files.server.mjs`;
- runtime `registry_sha256` must equal manifest `registry_sha256`;
- registry version, source, and operation counts must match the reviewed release.

`registry_file_sha256` is a separate hash of the generator output source file used for the build; it is not the runtime catalog-object hash. A legacy rollback snapshot may predate `installation.json`; treat its provenance as unverified until it is rebuilt from a known-good commit and reinstalled.

## Safe degraded operation

If the connector is unavailable, use the established CSV/XLSX or browser route only when the selected workflow supports it. Keep unsupported or unverifiable items open. Never improvise a generic API proxy, expose the token, treat a toast as proof, or change the Builder deployment as a connector workaround.
