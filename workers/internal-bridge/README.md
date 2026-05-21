# Internal Bridge Worker

Cloudflare Worker for internal Discount Furniture bridge operations (Lightspeed read/write bridge, GitHub template reads, description audit/rollback, and cleanup reports).

## Runtime variables

- `BRIDGE_API_KEY` (Secret)
- `LS_DOMAIN_PREFIX=discountfurniture`
- `LS_TOKEN` (Secret)
- `LS_WRITE_ENABLED=true|false`
- `PRODUCT_CREATE_ENABLED=true|false`
- `VARIANT_CREATE_ENABLED=true|false`
- `CATEGORY_RESOLUTION_REQUIRED=true|false`
- `LS_WRITE_TOKEN` (optional Secret)
- `LS_API_TOKEN` or `LS_TOKEN` (Secret, based on deployment naming)
- `GITHUB_TOKEN` (optional Secret)
- `GPT_FACADE_BRIDGE_URL` (optional, if routed through facade)
- `GPT_FACADE_BRIDGE_API_KEY` (optional Secret, if routed through facade)
- `DB` (D1 binding)

## Required D1 configuration

`workers/internal-bridge/wrangler.toml` is intentionally configured with:

- `database_name = "df-description-history"`
- `database_id = "REPLACE_WITH_REAL_D1_DATABASE_ID"`

> TODO: Replace `REPLACE_WITH_REAL_D1_DATABASE_ID` with the real Cloudflare D1 database ID before deployment. This Worker is **not ready for GitHub deployment** until this value is set.

Deployment trigger: pricing routes ready for Cloudflare redeploy.
