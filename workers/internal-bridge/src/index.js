const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const BRIDGE_VERSION = "2026-05-01";
const REPORT_TYPES = new Set([
  "product-cleanup-summary",
  "missing-descriptions",
  "short-descriptions",
  "placeholder-images",
  "webstore-disabled",
  "no-brand",
  "no-category",
  "template-ready",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET" && url.pathname === "/health") {
      return health(env);
    }
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);

    try {
      if (method === "GET" && url.pathname === "/products/search") return searchProducts(url, env);
      if (method === "GET" && /^\/products\/[^/]+$/.test(url.pathname)) return getProduct(url, env);
      if (method === "GET" && /^\/products\/[^/]+\/inventory$/.test(url.pathname)) return lsGet(`/api/2026-04/inventory/${getProductId(url.pathname)}`, env);
      if (method === "GET" && /^\/products\/[^/]+\/inventory-levels$/.test(url.pathname)) return lsGet(`/api/2026-04/inventory_levels/${getProductId(url.pathname)}`, env);
      if (method === "GET" && url.pathname === "/brands") return lsGet("/api/2026-04/brands", env);
      if (method === "GET" && url.pathname === "/suppliers") return lsGet("/api/2026-04/suppliers", env);
      if (method === "GET" && url.pathname === "/outlets") return lsGet("/api/2026-04/outlets", env);

      if (method === "GET" && url.pathname === "/templates/brands") return githubContent("brand-templates/brands", env);
      if (method === "GET" && url.pathname === "/templates/brand") return templateBrand(url, env);
      if (method === "GET" && /^\/templates\/brands\/[^/]+$/.test(url.pathname)) return githubContent(`brand-templates/brands/${url.pathname.split("/")[3]}`, env);
      if (method === "GET" && url.pathname === "/templates/registry") return githubContent("brand-templates/registry/brand-template-registry.html", env);
      if (method === "GET" && url.pathname === "/templates/readme") return githubContent("brand-templates/README.md", env);
      if (method === "GET" && url.pathname === "/templates/assets") return templateAssets(url, env);
      if (method === "GET" && url.pathname === "/templates/file") return githubContent(url.searchParams.get("path"), env);

      if (method === "POST" && /^\/products\/[^/]+\/description\/preview$/.test(url.pathname)) return descriptionPreview(request, url, env);
      if (method === "PUT" && /^\/products\/[^/]+\/description$/.test(url.pathname)) return descriptionUpdate(request, url, env);
      if (method === "POST" && /^\/products\/[^/]+\/description\/rollback\/preview$/.test(url.pathname)) return rollbackPreview(request, url, env);
      if (method === "PUT" && /^\/products\/[^/]+\/description\/rollback$/.test(url.pathname)) return rollbackApply(request, url, env);

      if (method === "GET" && url.pathname === "/audit/health") return auditHealth(env);
      if (method === "GET" && url.pathname === "/description-updates") return listHistory(url, env);
      if (method === "GET" && /^\/description-updates\/[^/]+$/.test(url.pathname)) return getHistory(url, env);
      if (method === "GET" && /^\/products\/[^/]+\/description\/history$/.test(url.pathname)) return productHistory(url, env);

      if (method === "GET" && /^\/reports\/[^/]+$/.test(url.pathname)) return catalogReport(url, env);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Internal error", detail: String(err) }, 500);
    }
  },
};

const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
const getProductId = (pathname) => decodeURIComponent(pathname.split("/")[2] || "");
const isWriteEnabled = (env) => String(env.LS_WRITE_ENABLED).toLowerCase() === "true";

function isAuthorized(request, env) {
  const key = env.BRIDGE_API_KEY;
  const auth = request.headers.get("authorization") || "";
  return Boolean(key) && auth === `Bearer ${key}`;
}

function health(env) {
  return json({
    ok: true,
    bridge_status: "online",
    version: BRIDGE_VERSION,
    write_enabled: isWriteEnabled(env),
    d1_binding_status: Boolean(env.DB),
    features: ["health", "lightspeed-read", "github-templates", "description-preview-update", "audit-history", "rollback", "cleanup-reports"],
  });
}

const lsBase = (env) => `https://${env.LS_DOMAIN_PREFIX}.retail.lightspeed.app`;
const lsHeaders = (env, write = false) => ({ authorization: `Bearer ${write && env.LS_WRITE_TOKEN ? env.LS_WRITE_TOKEN : env.LS_TOKEN}`, accept: "application/json", "content-type": "application/json" });
async function lsGet(path, env) { return passthrough(`${lsBase(env)}${path}`, { headers: lsHeaders(env) }); }
async function lsJson(path, env) { const r = await fetch(`${lsBase(env)}${path}`, { headers: lsHeaders(env) }); if (!r.ok) throw new Error(`Lightspeed GET failed ${r.status}`); return r.json(); }
async function lsPutProductDescription(productId, description, env) {
  const r = await fetch(`${lsBase(env)}/api/2.0/products/${productId}`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify({ description }) });
  if (!r.ok) throw new Error(`Lightspeed update failed ${r.status}`);
  return r.json();
}
async function passthrough(url, init) { const res = await fetch(url, init); return new Response(await res.text(), { status: res.status, headers: JSON_HEADERS }); }

async function fetchProduct(productId, env) {
  const obj = await lsJson(`/api/2.0/products/${productId}`, env);
  return obj.data || obj.product || obj;
}

async function searchProducts(url, env) {
  const params = new URLSearchParams(url.search);
  return lsGet(`/api/2.0/products?${params.toString()}`, env);
}
async function getProduct(url, env) { return lsGet(`/api/2.0/products/${getProductId(url.pathname)}`, env); }

async function githubContent(path, env) {
  if (!path) return json({ error: "Missing path" }, 400);
  const headers = { accept: "application/vnd.github+json", "user-agent": "df-internal-bridge" };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return passthrough(`https://api.github.com/repos/jacobsherman-spec/discount-furniture-site-scripts/contents/${path}`, { headers });
}
async function templateBrand(url, env) {
  const brand = url.searchParams.get("brand");
  if (!brand) return json({ error: "Missing brand" }, 400);
  return githubContent(`brand-templates/brands/${brand}.html`, env);
}
async function templateAssets(url, env) {
  const brand = (url.searchParams.get("brand") || "").toLowerCase();
  return githubContent(brand ? `media/brands/${brand}` : "media/brands", env);
}

const sha256Hex = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text || "")))).map((b) => b.toString(16).padStart(2, "0")).join("");
const isValidHtml = (html) => typeof html === "string" && html.trim().length > 0 && /<[^>]+>/.test(html);

async function descriptionPreview(request, url, env) {
  const body = await request.json();
  const product = await fetchProduct(getProductId(url.pathname), env);
  const current = product.description || "";
  const currentHash = await sha256Hex(current);
  const skuMatches = !body.confirm_sku || body.confirm_sku === (product.sku || product.customSku || "");
  const htmlValid = isValidHtml(body.html || "");
  return json({ product_id: String(product.id || getProductId(url.pathname)), sku: product.sku || null, html_valid: htmlValid, sku_match: skuMatches, current_description_sha256: currentHash, can_update: Boolean(htmlValid && skuMatches) });
}

async function descriptionUpdate(request, url, env) {
  if (!isWriteEnabled(env)) return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  if (!body.approved || !body.confirm_sku || !body.expected_current_description_sha256) return json({ error: "approved, confirm_sku, expected_current_description_sha256 required" }, 400);
  const product = await fetchProduct(getProductId(url.pathname), env);
  const current = product.description || "";
  if (body.confirm_sku !== (product.sku || product.customSku || "")) return json({ error: "SKU mismatch" }, 409);
  const currentHash = await sha256Hex(current);
  if (currentHash !== body.expected_current_description_sha256) return json({ error: "Current description changed", current_description_sha256: currentHash }, 409);
  const auditId = await insertHistory(env, { action_type: "update", status: "pending", product, old_description: current, new_description: body.html || "", approved: true, approved_by: body.approved_by || null, approval_note: body.approval_note || null, preview_hash: body.expected_current_description_sha256, source_urls_json: JSON.stringify(body.source_urls || []), lightspeed_status: "pending", rollback_of_id: null, result_json: null });
  const result = await lsPutProductDescription(product.id || getProductId(url.pathname), body.html || "", env);
  await updateHistoryStatus(env, auditId, "success", "updated", JSON.stringify(result));
  return json({ ok: true, audit_id: auditId, product_id: String(product.id || getProductId(url.pathname)) });
}

async function rollbackPreview(request, url, env) {
  const body = await request.json();
  if (!body.history_id) return json({ error: "history_id required" }, 400);
  const row = await env.DB.prepare("SELECT * FROM description_history WHERE id = ?").bind(body.history_id).first();
  if (!row) return json({ error: "History entry not found" }, 404);
  const product = await fetchProduct(getProductId(url.pathname), env);
  const currentHash = await sha256Hex(product.description || "");
  const skuMatches = !body.confirm_sku || body.confirm_sku === (product.sku || product.customSku || "");
  return json({ history_id: row.id, product_id: String(product.id), current_description_sha256: currentHash, rollback_target_description_preview: (row.old_description || "").slice(0, 500), sku_match: skuMatches, can_rollback: skuMatches });
}

async function rollbackApply(request, url, env) {
  if (!isWriteEnabled(env)) return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  if (!body.approved || !body.history_id || !body.confirm_sku || !body.expected_current_description_sha256) return json({ error: "approved, history_id, confirm_sku, expected_current_description_sha256 required" }, 400);
  const row = await env.DB.prepare("SELECT * FROM description_history WHERE id = ?").bind(body.history_id).first();
  if (!row) return json({ error: "History entry not found" }, 404);
  const product = await fetchProduct(getProductId(url.pathname), env);
  if (body.confirm_sku !== (product.sku || product.customSku || "")) return json({ error: "SKU mismatch" }, 409);
  const currentHash = await sha256Hex(product.description || "");
  if (currentHash !== body.expected_current_description_sha256) return json({ error: "Current description changed", current_description_sha256: currentHash }, 409);
  const restoreDesc = row.old_description || "";
  const auditId = await insertHistory(env, { action_type: "rollback", status: "pending", product, old_description: product.description || "", new_description: restoreDesc, approved: true, approved_by: body.approved_by || null, approval_note: body.approval_note || null, preview_hash: body.expected_current_description_sha256, source_urls_json: "[]", lightspeed_status: "pending", rollback_of_id: row.id, result_json: null });
  const result = await lsPutProductDescription(product.id || getProductId(url.pathname), restoreDesc, env);
  await env.DB.prepare("UPDATE description_history SET status = 'rolled_back', rolled_back_at = datetime('now') WHERE id = ?").bind(row.id).run();
  await updateHistoryStatus(env, auditId, "success", "rolled_back", JSON.stringify(result));
  return json({ ok: true, audit_id: auditId, rollback_of_id: row.id });
}

async function insertHistory(env, entry) {
  const oldHash = await sha256Hex(entry.old_description || "");
  const newHash = await sha256Hex(entry.new_description || "");
  const q = `INSERT INTO description_history (created_at,action_type,status,product_id,sku,product_name,brand,handle,old_description,new_description,old_description_sha256,new_description_sha256,old_description_length,new_description_length,approved,approved_by,approval_note,preview_hash,source_urls_json,lightspeed_status,bridge_version,rollback_of_id,result_json) VALUES (datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const res = await env.DB.prepare(q).bind(entry.action_type, entry.status, String(entry.product.id || ""), entry.product.sku || null, entry.product.name || null, entry.product.brand_name || entry.product.brand || null, entry.product.handle || null, entry.old_description || "", entry.new_description || "", oldHash, newHash, (entry.old_description || "").length, (entry.new_description || "").length, entry.approved ? 1 : 0, entry.approved_by, entry.approval_note, entry.preview_hash, entry.source_urls_json, entry.lightspeed_status, BRIDGE_VERSION, entry.rollback_of_id, entry.result_json).run();
  return res.meta.last_row_id;
}
async function updateHistoryStatus(env, id, status, lightspeed_status, result_json) {
  await env.DB.prepare("UPDATE description_history SET status = ?, lightspeed_status = ?, result_json = ? WHERE id = ?").bind(status, lightspeed_status, result_json, id).run();
}

async function listHistory(url, env) { const limit = Number(url.searchParams.get("limit") || 100); const r = await env.DB.prepare("SELECT * FROM description_history ORDER BY id DESC LIMIT ?").bind(limit).all(); return json(r.results || []); }
async function getHistory(url, env) { const id = url.pathname.split("/")[2]; const r = await env.DB.prepare("SELECT * FROM description_history WHERE id = ?").bind(id).first(); return r ? json(r) : json({ error: "Not found" }, 404); }
async function productHistory(url, env) { const productId = getProductId(url.pathname); const r = await env.DB.prepare("SELECT * FROM description_history WHERE product_id = ? ORDER BY id DESC LIMIT 200").bind(String(productId)).all(); return json(r.results || []); }
async function auditHealth(env) { try { await env.DB.prepare("SELECT COUNT(*) AS c FROM description_history").first(); return json({ ok: true, table: "description_history" }); } catch (e) { return json({ ok: false, error: String(e) }, 500); } }

async function catalogReport(url, env) {
  const report = url.pathname.split("/")[2];
  if (!REPORT_TYPES.has(report)) return json({ error: "Invalid report" }, 400);
  const scanLimit = Number(url.searchParams.get("scan_limit") || 250);
  const productsResp = await lsJson(`/api/2.0/products?limit=${scanLimit}`, env);
  const products = productsResp.data || [];
  const items = products.map((p) => ({ id: p.id, sku: p.sku || null, name: p.name || null, missing_description: !(p.description || "").trim(), short_description: (p.description || "").replace(/<[^>]*>/g, "").trim().length < 120, placeholder_image: !p.image_url || /placeholder|no-image/i.test(p.image_url), webstore_disabled: p.published === false || p.webstore === false, no_brand: !(p.brand_name || p.brand), no_category: !(p.category_name || p.category), template_ready: Boolean((p.brand_name || "").trim()) }));
  return json({ report_type: report, scanned: products.length, filters: Object.fromEntries(url.searchParams.entries()), prioritized_cleanup_items: items.filter((x) => x.missing_description || x.short_description || x.placeholder_image || x.webstore_disabled || x.no_brand || x.no_category).slice(0, Number(url.searchParams.get("limit") || 100)) });
}
