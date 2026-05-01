# Discount Furniture GPT Facade Worker

This Cloudflare Worker is a **public GPT-facing facade API** with a small surface area intended for ChatGPT Actions.
It exposes only four operations (`/health`, `/read`, `/preview`, `/write`) and forwards allowed requests to the internal bridge Worker.

The internal bridge remains the system of record for:
- Lightspeed product reads
- GitHub template reads
- Description previews and writes
- Audit/history and rollback flows
- Catalog cleanup reports

## Required environment variables

Set these as Cloudflare Worker secrets/vars (do not hardcode in source):

- `FACADE_API_KEY` - Bearer token required for `/read`, `/preview`, and `/write`
- `INTERNAL_BRIDGE_URL` - Base URL of the internal bridge Worker
- `INTERNAL_BRIDGE_API_KEY` - Bearer token used by this facade to call the internal bridge

## PowerShell test commands

> Replace placeholders before running.

```powershell
$FAC_URL = "https://YOUR-FACADE-WORKER.workers.dev"
$FAC_KEY = "YOUR_FACADE_API_KEY"

# 1) Health
Invoke-RestMethod -Method Get -Uri "$FAC_URL/health"

# 2) Read: searchProducts
$body = @{ action = "searchProducts"; q = "sofa" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$FAC_URL/read" -Headers @{ Authorization = "Bearer $FAC_KEY" } -ContentType "application/json" -Body $body

# 3) Read: catalogReport
$body = @{ action = "catalogReport"; reportType = "missing-descriptions" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$FAC_URL/read" -Headers @{ Authorization = "Bearer $FAC_KEY" } -ContentType "application/json" -Body $body

# 4) Preview: pricing_update (read-only preview)
$body = @{
  type = "pricing_update"
  productId = "12345"
  retail_price = 1499.99
  supplier_price = 999.50
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$FAC_URL/preview" -Headers @{ Authorization = "Bearer $FAC_KEY" } -ContentType "application/json" -Body $body
```

## Pricing writes intentionally disabled

`pricing_update` is implemented in `/preview` only. `/write` returns `501 Not Implemented` for pricing updates.
This is intentional until pricing audit logging and write scopes are fully implemented in the internal workflow.
