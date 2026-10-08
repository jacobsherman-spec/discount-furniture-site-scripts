# Token scope and automation map

Status basis: the sanitized 2026-10-07 private-app audit recorded 57 approved scopes for **Discount Furniture Local Operations**, with no missing, extra, or pending selections. This document is guidance only; no live app scope was changed.

## Recommended read-mostly automation scopes

Use a separate private app and DPAPI-protected token for unattended automation when possible. Select only the rows needed by the scheduled job and keep `DF_LIGHTSPEED_WRITES_ENABLED=false`.

| Read job | Candidate scopes | Boundary |
|---|---|---|
| Connection identity | `retailer:read` | Proves retailer identity only. |
| Catalog and price/cost exceptions | `products:read`, `products:read:costs`, optionally `products:read:price_books` | Zero or missing values still require source verification. |
| Physical stock and available-to-sell review | `inventory:read`, `products:read`, `products:read:costs`, `outlets:read` | Inventory records are physical facts; inventory levels are available-to-sell. Do not aggregate composites with components. |
| Purchasing and receiving review | `consignments:read`, `suppliers:read`, `products:read`, `products:read:costs`, `outlets:read` | Read evidence does not authorize receiving. |
| Statements and customer exceptions | `customers:read`, `sales:read`, `payments:read`, optionally `payment_types:read` | Native same-date exports remain the statement batch snapshot. |
| Delivery and fulfillment queue | `sales:read`, `customers:read`, `fulfillments:read`, `outlets:read` | Missing date, time, address, or confirmation stays in review. |
| Daily accounting evidence | `sales:read`, `payments:read`, `payment_types:read`, `registers:read`, `outlets:read` | Bank/processor evidence and QuickBooks saved state remain separate authoritative sources. |
| Specialized reference reads | `channels:read`, `custom_fields:read`, `gift_cards:read`, `promotions:read`, `serial_numbers:read`, `services:read`, `store_credits:read`, `taxes:read`, `users:read` | Add only for a defined job with a documented output. |

Avoid the combined `webhooks` scope on a read-only credential unless a webhook job is explicitly designed and reviewed; the same scope covers create, update, and delete operations in the fixed registry.

## Approved high-impact scopes not suitable for unattended reads

The supervised operations credential currently includes these categories. Runtime gating, the fixed registry, signed previews, and current-task authorization reduce risk, but they are not a substitute for least-privilege credentials.

Setting the Codex MCP registration to `DF_LIGHTSPEED_WRITES_ENABLED=false` turns off connector write execution; it does **not** remove or narrow any of the 57 scopes granted to the vendor-issued token. Scope reduction requires a separate private-app migration in Lightspeed. It must not regenerate, disconnect, or modify the existing Builder token.

| Risk group | Approved scopes |
|---|---|
| Stock, transfer, and fulfillment writes | `inventory:write`; `consignments:write:inventory_count`; `consignments:write:stock_order`; `consignments:write:stock_transfer`; `fulfillments:write` |
| Sales, payment, register, and communication actions | `sales:write`; `sales:send:receipt`; `payments:adjust`; `register:open`; `register:close` |
| Gift card, store credit, and loyalty value | `gift_cards:write:issue`; `gift_cards:write:redeem`; `gift_cards:write:setup`; `store_credits:write:issue`; `store_credits:write:redeem`; `store_credits:write:setup`; `loyalty:write:transaction` |
| Customer and catalog master data | `customers:write`; `customers:write:loyalty`; `products:write`; `products:write:costs`; `products:write:loyalty`; `products:write:price_books`; `suppliers:write` |
| Configuration and operational records | `custom_fields:write`; `outlets:write`; `payment_types:write`; `promotions:write`; `serial_numbers:write`; `services:write`; `taxes:write`; `webhooks` |

These permissions must remain supervised unless a much narrower operation class has its own source proof, authorization rule, deterministic verification, and successful pilot history.

## Approved scopes unused by the fixed registry

At the dated registry checkpoint, no exposed operation declares the following approved scopes:

- `customers:read:loyalty`
- `customers:write:loyalty`
- `fulfillments:write`
- `gift_cards:write:setup`
- `loyalty:write:transaction`
- `outlets:write`
- `payment_types:write`
- `payments:adjust`
- `products:write:loyalty`
- `sales:read:loyalty`
- `sales:send:receipt`
- `store_credits:write:setup`

"Unused by the registry" means the local server cannot select an operation requiring that scope. It does not make the permission harmless if the token were exposed or used by different software. Reassess these scopes when creating the future read-mostly app; do not remove them from the current app without a separate, verified scope-migration plan.

## Scope-change procedure

1. Export a fresh capability/scope comparison without revealing the token.
2. Map each scheduled or supervised workflow to exact operation IDs and declared scopes.
3. Pilot a separate read-mostly app/token before narrowing the operations app.
4. Verify retailer identity and every required read after the change.
5. Keep the existing Builder app and token outside this migration unless separately authorized.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layered authorization model and [RECOVERY.md](./RECOVERY.md) for safe rotation.
