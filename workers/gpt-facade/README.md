# Discount Furniture GPT Facade Worker

This Cloudflare Worker is a **public GPT-facing facade API** with a small surface area intended for ChatGPT Actions.

## Endpoints expected by GPT Actions

- `GET /health`
- `POST /categories/resolve`
- `POST /products/preview-create`
- `POST /products/create`
- `POST /variants/preview-create`
- `POST /variants/create`

`/health` always returns JSON (`application/json`). The write and preview routes require `Authorization: Bearer <FACADE_API_KEY>`.

## Required environment variables

Set these as Cloudflare Worker secrets/vars (do not hardcode in source):

- `FACADE_API_KEY` - Bearer token required for protected routes
- `INTERNAL_BRIDGE_URL` - Base URL of the internal bridge Worker (if service binding not used)
- `INTERNAL_BRIDGE_API_KEY` - Bearer token used by this facade to call the internal bridge

## curl test commands

> Replace placeholders before running.

```bash
FAC_URL="https://discount-furniture-gpt-facade.jacobsherman.workers.dev"
FAC_KEY="YOUR_FACADE_API_KEY"

# 1) Health (no auth)
curl -sS "$FAC_URL/health" | jq .

# 2) Resolve category
curl -sS -X POST "$FAC_URL/categories/resolve" \
  -H "Authorization: Bearer $FAC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product_category_name":"Bedroom Sets"}' | jq .

# 3) Product preview create
curl -sS -X POST "$FAC_URL/products/preview-create" \
  -H "Authorization: Bearer $FAC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product_description":{"description":"Preview product request"},"product_brand_id":1,"product_supplier_id":1,"product_outlet_id":1,"product_category_id":1}' | jq .

# 4) Product create (consequential)
curl -sS -X POST "$FAC_URL/products/create" \
  -H "Authorization: Bearer $FAC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"product_description":{"description":"Create product request"},"product_brand_id":1,"product_supplier_id":1,"product_outlet_id":1,"product_category_id":1}' | jq .

# 5) Variant preview create
curl -sS -X POST "$FAC_URL/variants/preview-create" \
  -H "Authorization: Bearer $FAC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"base_product_id":12345,"variant":{"description":"Preview variant request"}}' | jq .

# 6) Variant create (consequential)
curl -sS -X POST "$FAC_URL/variants/create" \
  -H "Authorization: Bearer $FAC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"base_product_id":12345,"variant":{"description":"Create variant request"}}' | jq .
```

## PowerShell test commands

```powershell
$FAC_URL = "https://discount-furniture-gpt-facade.jacobsherman.workers.dev"
$FAC_KEY = "YOUR_FACADE_API_KEY"
$headers = @{ Authorization = "Bearer $FAC_KEY" }

# 1) Health (no auth)
Invoke-RestMethod -Method Get -Uri "$FAC_URL/health"

# 2) Resolve category
$body = @{ product_category_name = "Bedroom Sets" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$FAC_URL/categories/resolve" -Headers $headers -ContentType "application/json" -Body $body

# 3) Product preview create
$body = @{
  product_description = @{ description = "Preview product request" }
  product_brand_id = 1
  product_supplier_id = 1
  product_outlet_id = 1
  product_category_id = 1
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$FAC_URL/products/preview-create" -Headers $headers -ContentType "application/json" -Body $body

# 4) Product create (consequential)
$body = @{
  product_description = @{ description = "Create product request" }
  product_brand_id = 1
  product_supplier_id = 1
  product_outlet_id = 1
  product_category_id = 1
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$FAC_URL/products/create" -Headers $headers -ContentType "application/json" -Body $body

# 5) Variant preview create
$body = @{
  base_product_id = 12345
  variant = @{ description = "Preview variant request" }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$FAC_URL/variants/preview-create" -Headers $headers -ContentType "application/json" -Body $body

# 6) Variant create (consequential)
$body = @{
  base_product_id = 12345
  variant = @{ description = "Create variant request" }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "$FAC_URL/variants/create" -Headers $headers -ContentType "application/json" -Body $body
```
