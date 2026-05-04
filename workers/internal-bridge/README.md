# Internal Bridge Worker

Cloudflare Worker for internal Discount Furniture bridge operations (Lightspeed read/write bridge, GitHub template reads, description audit/rollback, and cleanup reports).

## Runtime variables

- `BRIDGE_API_KEY` (Secret)
- `LS_DOMAIN_PREFIX=discountfurniture`
- `LS_TOKEN` (Secret)
- `LS_WRITE_ENABLED=true|false`
- `LS_WRITE_TOKEN` (optional Secret)
- `GITHUB_TOKEN` (optional Secret)
- `DB` (D1 binding)

## Required D1 configuration

`workers/internal-bridge/wrangler.toml` is intentionally configured with:

- `database_name = "df-description-history"`
- `database_id = "REPLACE_WITH_REAL_D1_DATABASE_ID"`

> TODO: Replace `REPLACE_WITH_REAL_D1_DATABASE_ID` with the real Cloudflare D1 database ID before deployment. This Worker is **not ready for GitHub deployment** until this value is set.

Deployment trigger: pricing routes ready for Cloudflare redeploy.
