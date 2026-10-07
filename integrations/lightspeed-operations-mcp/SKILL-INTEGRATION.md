# Workflow and skill integration

The local Lightspeed connector is a shared evidence and execution layer for Discount Furniture's catalog, monthly-statement, and QuickBooks-reconciliation workflows. Each workflow keeps its own source hierarchy, authorization boundary, checkpoint, and completion proof; connector availability never merges their permissions.

## Catalog workflow

The installed `liberty-lightspeed-product` skill uses this connector as one route inside its existing multi-brand workflow. The connector does not replace manufacturer-source reconciliation, exact product identity, sealed scope, CSV/XLSX imports, gallery work, saved-record proof, or public-storefront verification.

### Hybrid routing

- Use the MCP connector for fixed operations returned by `lightspeed_capabilities`, especially exact reads and narrow writes with deterministic baselines and reload verification.
- Use current-template CSV/XLSX imports for reliable repetitive fields, bulk product creation, variant families, composites, and export-reconciled batches.
- Use the browser for unsupported fields, images and no-cap gallery reconciliation, Best Home Furnishings 360, and public-storefront publishing or proof.
- A single task may use all three routes. Keep them under one scope/checkpoint so completed work is not repeated.

### MCP sequence

1. Check `lightspeed_connection_status` when connection state is uncertain.
2. Discover the exact fixed operation with `lightspeed_capabilities`.
3. Capture current evidence with `lightspeed_read`.
4. For a user-authorized change, satisfy the catalog skill's evidence and approval gates, then call `lightspeed_preview_change` and inspect its exact target, body, baseline, and expiry.
5. Apply the unchanged receipt with `lightspeed_execute_change`.
6. Reload through `lightspeed_verify_change`, then complete any fresh export or public-storefront proof required by the skill.

The signed preview is a technical control, not user approval. Existing authorization for the exact current task can be reused; registration, scopes, or capabilities never authorize unrelated stock, purchasing, sales, payment, customer, messaging, service, webhook, or settings changes.

## Monthly statements

The installed `discount-furniture-monthly-statements` skill keeps the fresh, same-date customer CSV and On Account sales-history CSV as the canonical batch snapshot. Its deterministic reconciler depends on the exact export schemas, including sale header, sale-line, and payment rows.

Use this connector as the live verification layer for exact customer, address/contact, sale, payment-history, and layaway exceptions. Useful current reads include `ListCustomers`, `GetCustomerByID`, `ListCustomerAddresses`, `ListCustomerContactChannels`, `ListSales`, and `GetSaleByID`, subject to the current `lightspeed_capabilities` result. Preserve the original exports and record a verified post-snapshot fact through the statement workflow's manual-review override.

Do not replace the two exports with API pages until a versioned adapter maps every required column, exhausts pagination, fixes one statement-date boundary, preserves row semantics, and produces a zero-mismatch same-date comparison. Statement preparation is read-only, and this connector does not send statements, receipts, texts, or customer messages.

## QuickBooks reconciliation

The installed `discount-furniture-quickbooks-reconciliation` skill coordinates the Meridian QuickBooks connector, this Lightspeed connector, authoritative bank statements/feed, processors such as Venmo, and vendor evidence. QuickBooks entities and reports come from the QuickBooks connector; Lightspeed sales, customers, purchase orders, suppliers, outlets, and inventory provide exact operational evidence. Bank-feed UI, bank statements, and unsupported portals remain browser/file sources.

Resume the newest saved reconciliation checkpoint rather than re-auditing completed batches. Match existing QuickBooks records before creating anything, separate gross receipts/fees/refunds/net deposits, preserve unresolved source holds, and never plug the residual book/bank difference. A QuickBooks write requires exact source evidence, a fresh record and `SyncToken`, a stable operation UUID for identical input, connector confirmation, a saved-record reload, and bank/Lightspeed verification. A QuickBooks reconciliation request does not authorize a Lightspeed write, and connector setup does not authorize either system's business changes.

## Availability and evidence labels

Codex may need a new task or app reload before a newly registered MCP server appears. If these tools are absent, stale, or report an old credential state, use the workflow's established export/browser route or reload; do not create an ad hoc generic API client or rotate a token inside a business workflow.

Keep approved private-app scopes, generated operation-registry coverage, mock safety tests, and live-tested operations clearly separated in reports. See [STATUS.md](STATUS.md) for the dated implementation/test map and [CAPABILITIES.md](CAPABILITIES.md) for generated registry coverage.
