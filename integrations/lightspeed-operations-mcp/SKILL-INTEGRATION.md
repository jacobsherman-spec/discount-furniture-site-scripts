# Catalog skill integration

The installed `liberty-lightspeed-product` skill uses this connector as one route inside its existing multi-brand workflow. The connector does not replace manufacturer-source reconciliation, exact product identity, sealed scope, CSV/XLSX imports, gallery work, saved-record proof, or public-storefront verification.

## Hybrid routing

- Use the MCP connector for fixed operations returned by `lightspeed_capabilities`, especially exact reads and narrow writes with deterministic baselines and reload verification.
- Use current-template CSV/XLSX imports for reliable repetitive fields, bulk product creation, variant families, composites, and export-reconciled batches.
- Use the browser for unsupported fields, images and no-cap gallery reconciliation, Best Home Furnishings 360, and public-storefront publishing or proof.
- A single task may use all three routes. Keep them under one scope/checkpoint so completed work is not repeated.

## MCP sequence

1. Check `lightspeed_connection_status` when connection state is uncertain.
2. Discover the exact fixed operation with `lightspeed_capabilities`.
3. Capture current evidence with `lightspeed_read`.
4. For a user-authorized change, satisfy the catalog skill's evidence and approval gates, then call `lightspeed_preview_change` and inspect its exact target, body, baseline, and expiry.
5. Apply the unchanged receipt with `lightspeed_execute_change`.
6. Reload through `lightspeed_verify_change`, then complete any fresh export or public-storefront proof required by the skill.

The signed preview is a technical control, not user approval. Existing authorization for the exact current task can be reused; registration, scopes, or capabilities never authorize unrelated stock, purchasing, sales, payment, customer, messaging, service, webhook, or settings changes.

## Availability and evidence labels

Codex may need a new task or app reload before a newly registered MCP server appears. If these tools are absent, use the skill's established spreadsheet/browser routes or reload; do not create an ad hoc generic API client.

Keep approved private-app scopes, generated operation-registry coverage, mock safety tests, and live-tested operations clearly separated in reports. See [STATUS.md](STATUS.md) for the dated implementation/test map and [CAPABILITIES.md](CAPABILITIES.md) for generated registry coverage.
