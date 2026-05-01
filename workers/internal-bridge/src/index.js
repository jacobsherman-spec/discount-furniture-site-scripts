const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
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
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    try {
      if (method === "GET" && url.pathname === "/products/search") return searchProducts(url, env);
      if (method === "GET" && url.pathname.match(/^\/products\/[^/]+$/)) return getProduct(url, env);
      if (method === "GET" && url.pathname.match(/^\/products\/[^/]+\/inventory$/)) return getProductInventory(url, env);
      if (method === "GET" && url.pathname.match(/^\/products\/[^/]+\/inventory-levels$/)) return getProductInventoryLevels(url, env);
      if (method === "GET" && url.pathname === "/brands") return lsGet("/API/Account/Brand.json", env);
      if (method === "GET" && url.pathname === "/suppliers") return lsGet("/API/Account/Supplier.json", env);
      if (method === "GET" && url.pathname === "/outlets") return lsGet("/API/Account/Outlet.json", env);

      if (method === "GET" && url.pathname === "/templates/brands") return githubTemplatesList(env);
      if (method === "GET" && url.pathname === "/templates/brand") return githubTemplateBrand(url, env);
      if (method === "GET" && url.pathname === "/templates/registry") return githubTemplateFile("templates/template-index.json", env);
      if (method === "GET" && url.pathname === "/templates/readme") return githubTemplateFile("templates/README.md", env);
      if (method === "GET" && url.pathname === "/templates/assets") return githubTemplateFile("templates/brand-template-assets.json", env);
      if (method === "GET" && url.pathname === "/templates/file") return githubTemplateFile(url.searchParams.get("path"), env);

      if (method === "POST" && url.pathname.match(/^\/products\/[^/]+\/description\/preview$/)) return descriptionPreview(request, url, env);
      if (method === "PUT" && url.pathname.match(/^\/products\/[^/]+\/description$/)) return descriptionUpdate(request, url, env);
      if (method === "GET" && url.pathname.match(/^\/products\/[^/]+\/description\/history$/)) return productHistory(url, env);
      if (method === "GET" && url.pathname === "/description-updates") return listHistory(env);
      if (method === "GET" && url.pathname.match(/^\/description-updates\/[^/]+$/)) return getHistory(url, env);
      if (method === "GET" && url.pathname === "/audit/health") return auditHealth(env);
      if (method === "POST" && url.pathname.match(/^\/products\/[^/]+\/description\/rollback\/preview$/)) return rollbackPreview(request, url, env);
      if (method === "PUT" && url.pathname.match(/^\/products\/[^/]+\/description\/rollback$/)) return rollbackApply(request, url, env);

      if (method === "GET" && url.pathname.match(/^\/reports\/[^/]+$/)) return catalogReport(url, env);

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: "Internal error", detail: String(err) }, 500);
    }
  },
};

function isAuthorized(request, env) {
  const required = env.BRIDGE_API_KEY;
  const auth = request.headers.get("authorization") || "";
  return Boolean(required) && auth === `Bearer ${required}`;
}

function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS }); }
function getProductId(pathname) { return decodeURIComponent(pathname.split("/")[2] || ""); }
function lsBase(env) { return `https://${env.LS_DOMAIN_PREFIX}.retail.lightspeed.app`; }
function lsHeaders(env, write = false) {
  const token = write && env.LS_WRITE_TOKEN ? env.LS_WRITE_TOKEN : env.LS_TOKEN;
  return { "Authorization": `Bearer ${token}`, "Accept": "application/json", "Content-Type": "application/json" };
}
async function lsGet(path, env) { return passthrough(`${lsBase(env)}${path}`, { headers: lsHeaders(env) }); }
async function passthrough(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return new Response(text, { status: res.status, headers: JSON_HEADERS });
}

async function searchProducts(url, env) {
  const q = url.searchParams.get("q");
  const sku = url.searchParams.get("sku");
  const limit = url.searchParams.get("limit") || "50";
  const offset = url.searchParams.get("offset") || "0";
  const clauses = ["deleted=false"];
  if (q) clauses.push(`description,sku,customSku,brandName CONTAINS \"${q.replace(/\"/g, "")}\"`);
  if (sku) clauses.push(`sku=\"${sku.replace(/\"/g, "")}\"`);
  const path = `/API/Account/Product.json?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&load_relations=[\"ProductShops\",\"Brand\",\"Category\"]&where=${encodeURIComponent(clauses.join(" AND "))}`;
  return lsGet(path, env);
}

async function getProduct(url, env) { return lsGet(`/API/Account/Product/${getProductId(url.pathname)}.json?load_relations=["ProductShops","Brand","Category","ProductSuppliers"]`, env); }
async function getProductInventory(url, env) { return lsGet(`/API/Account/Product/${getProductId(url.pathname)}.json?load_relations=["Item"]`, env); }
async function getProductInventoryLevels(url, env) { return lsGet(`/API/Account/Inventory.json?where=${encodeURIComponent(`productID=${getProductId(url.pathname)}`)}`, env); }

async function githubApi(path, env) {
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "df-internal-bridge" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return passthrough(`https://api.github.com/repos/jacobsherman-spec/discount-furniture-site-scripts/contents/${path}`, { headers });
}
async function githubTemplatesList(env) { return githubApi("templates/brand", env); }
async function githubTemplateBrand(url, env) {
  const brand = url.searchParams.get("brand");
  if (!brand) return json({ error: "Missing brand" }, 400);
  return githubApi(`templates/brand/${encodeURIComponent(brand)}.md`, env);
}
async function githubTemplateFile(path, env) {
  if (!path) return json({ error: "Missing path" }, 400);
  return githubApi(path, env);
}

async function descriptionPreview(request) {
  const body = await request.json();
  return json({ action: "description_preview", valid: Boolean(body.html), product_id: body.product_id || null, html_length: (body.html || "").length });
}
async function descriptionUpdate(request, url, env) {
  if (String(env.LS_WRITE_ENABLED).toLowerCase() !== "true") return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  const productId = getProductId(url.pathname);
  const before = await fetch(`${lsBase(env)}/API/Account/Product/${productId}.json`, { headers: lsHeaders(env) }).then(r => r.json());
  const payload = { Product: { description: body.html || "" } };
  const res = await fetch(`${lsBase(env)}/API/Account/Product/${productId}.json`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify(payload) });
  const afterText = await res.text();
  await writeHistory(env, productId, before?.Product?.description || "", body.html || "", body.confirm_sku || null, "update");
  return new Response(afterText, { status: res.status, headers: JSON_HEADERS });
}
async function rollbackPreview(request) { const body = await request.json(); return json({ action: "rollback_preview", history_id: body.history_id || null }); }
async function rollbackApply(request, url, env) {
  if (String(env.LS_WRITE_ENABLED).toLowerCase() !== "true") return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  if (!body.history_id) return json({ error: "history_id required" }, 400);
  const row = await env.DB.prepare("SELECT * FROM description_history WHERE id = ?").bind(body.history_id).first();
  if (!row) return json({ error: "History entry not found" }, 404);
  const productId = getProductId(url.pathname);
  const payload = { Product: { description: row.old_description || "" } };
  const res = await fetch(`${lsBase(env)}/API/Account/Product/${productId}.json`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify(payload) });
  const text = await res.text();
  await writeHistory(env, productId, row.new_description || "", row.old_description || "", body.confirm_sku || null, "rollback");
  return new Response(text, { status: res.status, headers: JSON_HEADERS });
}

async function writeHistory(env, productId, oldDesc, newDesc, sku, action) {
  await env.DB.prepare(`INSERT INTO description_history (product_id, old_description, new_description, confirm_sku, action, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
    .bind(String(productId), oldDesc, newDesc, sku, action).run();
}
async function listHistory(env) { const r = await env.DB.prepare("SELECT id, product_id, confirm_sku, action, created_at FROM description_history ORDER BY id DESC LIMIT 200").all(); return json(r.results || []); }
async function getHistory(url, env) { const id = url.pathname.split("/")[2]; const r = await env.DB.prepare("SELECT * FROM description_history WHERE id = ?").bind(id).first(); return r ? json(r) : json({ error: "Not found" }, 404); }
async function productHistory(url, env) { const productId = getProductId(url.pathname); const r = await env.DB.prepare("SELECT * FROM description_history WHERE product_id = ? ORDER BY id DESC LIMIT 200").bind(String(productId)).all(); return json(r.results || []); }
async function auditHealth(env) { try { await env.DB.prepare("SELECT 1").first(); return json({ ok: true }); } catch (e) { return json({ ok: false, error: String(e) }, 500); } }

async function catalogReport(url, env) {
  const report = url.pathname.split("/")[2];
  if (!REPORT_TYPES.has(report)) return json({ error: "Invalid report type", valid_report_types: [...REPORT_TYPES] }, 400);
  const products = await fetch(`${lsBase(env)}/API/Account/Product.json?limit=200&offset=0&load_relations=[\"ProductShops\",\"Brand\",\"Category\"]&where=${encodeURIComponent("deleted=false")}`, { headers: lsHeaders(env) }).then(r => r.json());
  return json({ report_type: report, generated_at: new Date().toISOString(), source_count: products?.Product?.length || 0, note: "Filtering for specific report type should be applied in downstream tooling as needed." });
}
