# Discount Furniture — Site Scripts
Hosted JS & CSS for Lightspeed **E‑Series (InstantSite)** with loaders to bypass the 4,000‑character inline script limit. 
Use together with a **Cloudflare Worker** proxy for CSP‑safe delivery and versioning.

---

## What’s in this repo

```
/scripts
  product-card.js        # sticky/scrollable PDP sidebar sizing
  price-format.js        # superscript cents and optional hide-decimals
  mattress-spin.js       # interactive "tap-to-spin" feature placeholder
/styles
  product-layout.css     # PDP/gallery sizing & layout helpers
  ribbons.css            # simple product ribbons/badges
/snippets
  loader-product-card.html
  loader-price-format.html
  loader-mattress-spin.html
/worker
  worker.js              # Cloudflare Worker proxy (recommended)
  wrangler.example.toml  # Wrangler config template
LICENSE
README.md
```

> **Why this setup?**  
> InstantSite caps inline `<script>` to ~4K chars and blocks `<script src>` from some CDNs. This repo + Cloudflare Worker serves your JS/CSS from a domain you control and keeps scripts versioned.

---

## Quick start

### 1) Publish this repo on GitHub
1. Create a new repo named **`discount-furniture-site-scripts`** (public or private).
2. Upload these files (or `git push` the whole folder).

### 2) (Recommended) Deploy the Cloudflare Worker proxy
You have two delivery options:

**A. Cloudflare Worker (CSP‑friendly)**
- Install Cloudflare Wrangler: `npm i -g wrangler`
- Copy `worker/wrangler.example.toml` to `wrangler.toml`
- Edit `account_id` and `name`
- From the `worker` folder:  
  ```bash
  wrangler deploy
  ```
- Map a subdomain (optional): `scripts.discountfurniture.com`

**B. GitHub Pages / jsDelivr (may be CSP‑blocked)**
- Enable GitHub Pages on the repo  
- Or use jsDelivr: `https://cdn.jsdelivr.net/gh/<user>/<repo>@<tag>/scripts/product-card.js`

### 3) Use the tiny loader snippets in InstantSite
Open **InstantSite → Settings → Tracking & Analytics → Custom code (head)** (or product/page level custom code) and paste the specific loader snippet you need from `/snippets`.

Example (product card sidebar sizing):
```html
<!-- DF loader: product-card -->
<script>(function(){var s=document.createElement('script');s.defer=true;s.src='https://scripts.discountfurniture.workers.dev/scripts/product-card.js';document.head.appendChild(s);})();</script>
```

### 4) Configure features in-page (optional)
Most scripts read data attributes so you can control behavior without editing JS.

Example:
```html
<div class="df-pdp" data-df-sticky="1" data-df-maxheight="calc(100vh - 24px)"></div>
```

---

## Files Overview

### `/scripts/product-card.js`
- Auto-sizes PDP sidebar to match gallery height
- Scrolls **inside** the card (not over the description)
- Disables on mobile (≤ 1024px) by default

### `/scripts/price-format.js`
- Converts `$1,599.95` → `$1,599` with `95` as superscript (or hides decimals)
- Works on PDP and category grids where possible
- Non-destructive (can be reverted by reloading or toggling option)

### `/scripts/mattress-spin.js`
- Placeholder for spin/expandable mattress layers
- Tap/click toggles active layer; designed to be lightweight and accessible

### `/styles/product-layout.css`
- Normalizes gallery width vs. sidebar
- Fixes overflow issues from InstantSite default CSS

### `/styles/ribbons.css`
- Simple, reusable badge styles (`Best Seller`, `Top Grain Leather`, etc.)

---

## How to update
1. Edit files locally
2. Commit with a clear message: `git commit -m "feat(pdp): improve sidebar sizing"`
3. `git push`
4. (Worker) redeploy only if you changed `worker/*`. For script/style updates, the Worker proxies GitHub/Pages—no redeploy needed if you point the Worker at raw Git URLs.

---

## Security & performance
- Worker sets `Cache-Control: public, max-age=3600` (tune as desired).
- Scripts run in `defer` mode to avoid blocking rendering.
- Keep scripts *framework‑free* (no jQuery/React).

---

## Support toggles (data‑attributes)
- `data-df-sticky="0|1"` — enable/disable sticky/scroll for PDP sidebar
- `data-df-hide-decimals="0|1"` — hide decimals instead of superscripting
- `data-df-mobile-breakpoint="1024"` — override breakpoint

---

© Discount Furniture. MIT License for general code; see `LICENSE`.
