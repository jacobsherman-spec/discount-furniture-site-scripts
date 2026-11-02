# Capability and verification status

Status date: 2026-10-07

The adapter implements 201 fixed operations from the official Lightspeed API surface. "Implemented" means the operation can be selected, validated, called, previewed when mutating, audited, and verified where a deterministic reload exists. It does not mean that every write endpoint was exercised against production; setup deliberately performed no live business-record mutation.

| Domain | Adapter status | Live evidence | Write evidence | Important boundary |
|---|---|---|---|---|
| Retailer identity | Implemented | `GetRetailer` HTTP 200 | Not applicable | Used to prove the token is connected to the intended retailer domain. |
| Products and product families | Implemented, including 2026-07 and preferred 2026-10 family model | List/detail/family HTTP 200 | Signed live preview plus mocked execution/verification | Exact SKU/family identity is required. Multipart image upload remains specialized. |
| Supplier cost and retail pricing | Implemented through product/product-family updates and price books | `supply_price`, `average_cost`, and `total_cost` field names observed; values not logged | Cost scopes approved; mutation path mock-tested only | Registry conservatively declares `products:read:costs` and `products:write:costs`. A live cost write was not authorized. |
| Inventory and stock adjustments | Implemented | Inventory records and inventory levels HTTP 200 | Drift/replay/audit path mock-tested | Inventory records represent physical stock facts. `current_inventory_level` is available-to-sell. Never double-count composite parents and components. |
| Purchase orders, consignments, and receiving | Implemented for documented API operations | Purchase-order list HTTP 200 | Generic preview/execute path mock-tested | Reload exact PO/consignment and line counts after writes. Browser fallback only for an unsupported UI-only field. |
| Suppliers and outlets | Implemented for documented API operations | Supplier/outlet lists HTTP 200 | Generic write path mock-tested | The approved app has broader outlet-write permission than the current official catalog documents. Undocumented actions are not proxied. |
| Customers and custom fields | Implemented for documented API operations | Customer list HTTP 200 | CRUD/custom-field path available; generic write path mock-tested | Identity must be confirmed before mutation. No customer messaging is implemented. |
| Sales, returns, and fulfillment records | Implemented where documented | Sales list HTTP 200; fulfillment read operations cataloged | Generic sale-record path mock-tested | Record access does not itself charge/refund a card. Fulfillment-write scope is approved, but undocumented operations are not invented. |
| Promotions, gift cards, and store credits | Implemented where documented | Scope/app approval; not live-read broadly during setup | Generic write path mock-tested | Financial/high-impact operations require exact current-task authorization and targeted post-write reads. |
| Services | Implemented for documented service/job endpoints | Service list HTTP 200 | Generic write path mock-tested | Confirm service/customer identity before mutation. |
| Webhooks | Implemented | Webhook list HTTP 200 | Create/update/delete path cataloged; generic write path mock-tested | URLs are fixed by operation schema; no arbitrary API proxy exists. |
| Registers, taxes, payment types, users | Read and documented operations implemented | Representative token scopes approved | Only documented operations exposed | Primary-admin identity, security audit, and user writes are deliberately excluded. |
| eCom publication/channel changes | Not proven | Channel scope approval/read capability only | Not claimed | A channel read does not prove publication writes. Use a verified endpoint or browser fallback. |
| Product image upload | Browser/API-specialized | Not tested | Not in JSON adapter | Official endpoint is multipart; preserve exact product/image matching. |
| Card charging/refunds | Not implemented as a payment processor | None | None | Sale/payment record writes are not permission to initiate processor transactions. |
| Receipt sending and customer messages | Not implemented | None | None | Keep communications as drafts/reminders unless separately authorized and supported. |
| Partner billing, audit, primary-admin, business rules, remote rules | Deliberately excluded | Zero selected scopes in app audit | None | Outside the identified Discount Furniture operational need. |

## Test evidence

The `expected-state-v1` verification contract no longer treats an arbitrary resource-hash change as proof of the requested write. Same-resource updates must reload with every requested field/value present; exact resource deletes require `404`/`410`; unsupported action, create, bulk, collection-member, or unmapped request shapes remain `verification_required`. See [VERIFICATION.md](./VERIFICATION.md).

- Separate **Discount Furniture Local Operations** app: installed, 57 approved scopes, zero missing/extra/pending, eight intentional exclusions.
- Local credential: DPAPI encrypted; runtime transfer uses a private one-use Windows named pipe; token and values were never logged.
- MCP: installed stdio handshake passed and exposed six tools.
- Unit tests: the current suite passes and covers allowlist rejection, referenced parameters, required queries, preview no-write, tamper/expiry, drift, exclusive replay reservation, exact requested-state assertions, conservative unsupported-operation results, delete verification, and configuration/audit gates.
- Dependency audit: no known production vulnerabilities.
- Live verification: representative read domains returned HTTP 200; a signed preview and verification reload returned `write_executed: false` and an unchanged baseline.

## Recommended operating practice

Choose the route by task fit rather than assuming API-only, spreadsheet-only, or browser-only execution. Prefer the connector for supported exact operations with deterministic evidence, current-template CSV/XLSX for reliable bulk catalog work, and the browser for unsupported capabilities such as multipart image work or a publication action that lacks a documented endpoint. For every consequential connector write, preview the exact request, execute the signed receipt once, then reload the saved record and compare the intended fields/counts; also complete any export or public-storefront proof required by the business workflow.
