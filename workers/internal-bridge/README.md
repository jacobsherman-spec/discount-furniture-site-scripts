# Internal Bridge Worker

This Worker is the internal bridge used by Discount Furniture automation flows. It centralizes Lightspeed read/write helper routes, GitHub template read routes, description preview/update/rollback operations, D1-backed description history audit, and catalog cleanup reports.

## Required Cloudflare Worker variables

- `BRIDGE_API_KEY`
- `LS_DOMAIN_PREFIX`
- `LS_TOKEN`
- `LS_WRITE_ENABLED`
- Optional: `LS_WRITE_TOKEN`
- Optional: `GITHUB_TOKEN`

## Required bindings

- D1 binding `DB` is required for description audit/history storage and retrieval.

## Deployment

```bash
npm install
npm run deploy
```

## Architecture

The public facade Worker calls this internal bridge Worker via a Cloudflare service binding. This Worker should remain private/internal and only accept authorized bridge requests.
