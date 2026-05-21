# Product Creation Dry-Run / Test Examples

Set these vars before testing:
- `PRODUCT_CREATE_ENABLED=true`
- `VARIANT_CREATE_ENABLED=true`
- `LS_WRITE_ENABLED=true`
- `CATEGORY_RESOLUTION_REQUIRED=true`

## Standard product preview
```bash
curl -sS -X POST "$BRIDGE_URL/products/create/preview" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" -H "Content-Type: application/json" \
  -d '{"sku":"DRYRUN-100","product_name":"Reclining Sofa","brand_name":"Mega Motion","supplier_name":"Acme","product_category_name":"Reclining Sofas","retail_price":999.99,"supplier_price":499.99}'
```

## Standard product create
```bash
curl -sS -X POST "$BRIDGE_URL/products/create" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" -H "Content-Type: application/json" \
  -d '{"approved":true,"confirm_sku":"DRYRUN-100","sku":"DRYRUN-100","product_name":"Reclining Sofa","brand_name":"Mega Motion","supplier_name":"Acme","product_category_name":"Reclining Sofas","retail_price":999.99,"supplier_price":499.99}'
```

## Variant product preview
```bash
curl -sS -X POST "$BRIDGE_URL/products/variants/create/preview" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" -H "Content-Type: application/json" \
  -d '{"product_name":"Power Reclining Console Loveseat w/ Headrest","brand_id":"12","product_category_name":"Reclining Loveseats","variant_option_name":"Cover","variants":[{"sku":"DRYVAR-100-A","variant_value":"Gray","retail_price":1499.99},{"sku":"DRYVAR-100-B","variant_value":"Brown","retail_price":1499.99}]}'
```

## Variant product create
```bash
curl -sS -X POST "$BRIDGE_URL/products/variants/create" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" -H "Content-Type: application/json" \
  -d '{"approved":true,"product_name":"Power Reclining Console Loveseat w/ Headrest","confirm_product_name":"Power Reclining Console Loveseat w/ Headrest","brand_id":"12","product_category_name":"Reclining Loveseats","variant_option_name":"Cover","variants":[{"sku":"DRYVAR-100-A","variant_value":"Gray","retail_price":1499.99},{"sku":"DRYVAR-100-B","variant_value":"Brown","retail_price":1499.99}]}'
```

## Failed category match
```bash
curl -sS -X POST "$BRIDGE_URL/products/create/preview" \
  -H "Authorization: Bearer $BRIDGE_API_KEY" -H "Content-Type: application/json" \
  -d '{"sku":"DRYRUN-404","product_name":"Reclining Sofa","brand_name":"Mega Motion","product_category_name":"Not A Real Category","retail_price":999.99}'
```

## Successful category resolution
Use a nearby category name like `Reclining Sofa` and verify `validation.resolved.product_category_id` is returned.

## can_create true/false behavior
- Expect `can_create=false` if any required field or resolver fails.
- Expect `can_create=true` only when validation is clean and feature flags are enabled.
