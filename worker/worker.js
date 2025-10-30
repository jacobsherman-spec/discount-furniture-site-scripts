/**
 * Cloudflare Worker — proxy for GitHub Pages/jsDelivr to satisfy CSP and set cache headers.
 * Route example: https://scripts.discountfurniture.workers.dev/scripts/product-card.js
 * Configure your origin in ORIGIN_BASE below.
 */
const ORIGIN_BASE = 'https://<YOUR-GITHUB-USERNAME>.github.io/discount-furniture-site-scripts';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = ORIGIN_BASE + url.pathname;
    const upstream = await fetch(target);
    const text = await upstream.text();
    const contentType = target.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
        'x-proxied-from': target
      }
    });
  }
};
