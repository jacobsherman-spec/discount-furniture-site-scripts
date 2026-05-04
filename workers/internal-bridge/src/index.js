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

      if (method === "POST" && /^\/products\/[^/]+\/pricing\/preview$/.test(url.pathname)) return pricingPreview(request, url, env);
      if (method === "PUT" && /^\/products\/[^/]+\/pricing$/.test(url.pathname)) return pricingUpdate(request, url, env);
      if (method === "GET" && /^\/products\/[^/]+\/pricing\/history$/.test(url.pathname)) return pricingHistory(url, env);
      if (method === "POST" && /^\/products\/[^/]+\/pricing\/rollback\/preview$/.test(url.pathname)) return pricingRollbackPreview(request, url, env);
      if (method === "PUT" && /^\/products\/[^/]+\/pricing\/rollback$/.test(url.pathname)) return pricingRollbackApply(request, url, env);

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
    service: "internal-bridge",
    version: BRIDGE_VERSION,
    mode: "internal",
    write_enabled: isWriteEnabled(env),
    d1_bound: Boolean(env.DB),
    features: ["health", "lightspeed-read", "github-templates", "description-preview-update", "pricing-preview", "audit-history", "rollback", "cleanup-reports"],
  });
}

const lsBase = (env) => `https://${env.LS_DOMAIN_PREFIX}.retail.lightspeed.app`;
const lsHeaders = (env, write = false) => ({ authorization: `Bearer ${write && env.LS_WRITE_TOKEN ? env.LS_WRITE_TOKEN : env.LS_TOKEN}`, accept: "application/json", "content-type": "application/json" });
async function lsGet(path, env) { return passthrough(`${lsBase(env)}${path}`, { headers: lsHeaders(env) }); }
async function lsJson(path, env) { const r = await fetch(`${lsBase(env)}${path}`, { headers: lsHeaders(env) }); if (!r.ok) throw new Error(`Lightspeed GET failed ${r.status}`); return r.json(); }
async function lsPutProductDescription(productId, description, env) {
  const r = await fetch(`${lsBase(env)}/api/2026-04/products/${productId}`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify({ common: { description } }) });
  if (!r.ok) throw new Error(`Lightspeed update failed ${r.status}`);
  return r.json();
}
async function passthrough(url, init) { const res = await fetch(url, init); return new Response(await res.text(), { status: res.status, headers: JSON_HEADERS }); }

async function fetchProduct(productId, env) {
  const obj = await lsJson(`/api/2.0/products/${productId}`, env);
  return unwrapProductResponse(obj);
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
  const normalizedBrand = normalizeBrandSlug(brand);
  return githubContent(`brand-templates/brands/${normalizedBrand}.html`, env);
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
  if (!isValidHtml(body.html || "")) return json({ error: "Invalid html payload" }, 400);
  const currentHash = await sha256Hex(current);
  if (currentHash !== body.expected_current_description_sha256) return json({ error: "Current description changed", current_description_sha256: currentHash }, 409);
  const auditId = await insertHistory(env, { action_type: "update", status: "pending", product, old_description: current, new_description: body.html || "", approved: true, approved_by: body.approved_by || null, approval_note: body.approval_note || null, preview_hash: body.expected_current_description_sha256, source_urls_json: JSON.stringify(body.source_urls || []), lightspeed_status: "pending", rollback_of_id: null, result_json: null });
  try {
    const result = await lsPutProductDescription(product.id || getProductId(url.pathname), body.html || "", env);
    await updateHistoryStatus(env, auditId, "success", "updated", JSON.stringify(result));
    return json({ ok: true, audit_id: auditId, product_id: String(product.id || getProductId(url.pathname)) });
  } catch (err) {
    await updateHistoryStatus(env, auditId, "failed", "failed", JSON.stringify({ error: String(err) }));
    throw err;
  }
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
  try {
    const result = await lsPutProductDescription(product.id || getProductId(url.pathname), restoreDesc, env);
    await env.DB.prepare("UPDATE description_history SET status = 'rolled_back', rolled_back_at = datetime('now') WHERE id = ?").bind(row.id).run();
    await updateHistoryStatus(env, auditId, "success", "rolled_back", JSON.stringify(result));
    return json({ ok: true, audit_id: auditId, rollback_of_id: row.id });
  } catch (err) {
    await updateHistoryStatus(env, auditId, "failed", "failed", JSON.stringify({ error: String(err) }));
    throw err;
  }
}

async function insertHistory(env, entry) {
  const id = crypto.randomUUID();
  const oldHash = await sha256Hex(entry.old_description || "");
  const newHash = await sha256Hex(entry.new_description || "");
  const q = `INSERT INTO description_history (id,created_at,action_type,status,product_id,sku,product_name,brand,handle,old_description,new_description,old_description_sha256,new_description_sha256,old_description_length,new_description_length,approved,approved_by,approval_note,preview_hash,source_urls_json,lightspeed_status,bridge_version,rollback_of_id,result_json) VALUES (?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  await env.DB.prepare(q).bind(id, entry.action_type, entry.status, String(entry.product.id || ""), entry.product.sku || null, entry.product.name || null, entry.product.brand_name || entry.product.brand || null, entry.product.handle || null, entry.old_description || "", entry.new_description || "", oldHash, newHash, (entry.old_description || "").length, (entry.new_description || "").length, entry.approved ? 1 : 0, entry.approved_by, entry.approval_note, entry.preview_hash, entry.source_urls_json, entry.lightspeed_status, BRIDGE_VERSION, entry.rollback_of_id, entry.result_json).run();
  return id;
}
async function updateHistoryStatus(env, id, status, lightspeed_status, result_json) {
  await env.DB.prepare("UPDATE description_history SET status = ?, lightspeed_status = ?, result_json = ? WHERE id = ?").bind(status, lightspeed_status, result_json, id).run();
}


async function pricingPreview(request, url, env) {
  try {
    const productId = getProductId(url.pathname);
    const body = await request.json();
    const product = await fetchProduct(productId, env);
    const errors = [];
    const warnings = [];

    if (!body.confirm_sku) errors.push("confirm_sku required");
    if (body.price_update_type !== "supplier_price") errors.push("price_update_type must be supplier_price");

    const newSupplierPrice = Number(body.supplier_price);
    if (!Number.isFinite(newSupplierPrice) || newSupplierPrice < 0) errors.push("supplier_price must be a nonnegative number");

    const skuMatches = body.confirm_sku ? skuMatchesProduct(product, body.confirm_sku) : false;
    if (body.confirm_sku && !skuMatches) errors.push("SKU mismatch");

    const selectedResult = selectProductSupplier(product, body.product_supplier_id);
    if (selectedResult.error) errors.push(selectedResult.error);
    const selected = selectedResult.selected || {};
    const currentHash = selectedResult.selected ? await computePriceHash(product, selectedResult.selected) : null;

    return json({
      preview_only: true,
      pricing_write_enabled: isWriteEnabled(env),
      can_update: errors.length === 0,
      product: { id: String(product.id || productId), sku: stringOrNull(normalizeSku(product)), name: product.name || null, brand: product.brand_name || product.brand || null },
      selected_supplier: selected,
      old_supplier_price: toNumberOrNull(selected.price ?? selected.supply_price ?? selected.supplier_price),
      new_supplier_price: Number.isFinite(newSupplierPrice) ? newSupplierPrice : null,
      old_supplier_code: selected.code || selected.supplier_code || null,
      new_supplier_code: Object.prototype.hasOwnProperty.call(body, "supplier_code") ? body.supplier_code : (selected.code || selected.supplier_code || null),
      current_price_hash: currentHash,
      validation: { ok: errors.length === 0, errors, warnings },
    });
  } catch (err) {
    return json({ error: "Pricing preview failed", detail: err instanceof Error ? err.message : "Unexpected error", route: "pricingPreview" }, 500);
  }
}

async function pricingUpdate(request, url, env) {
  if (!isWriteEnabled(env)) return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  if (!body.approved || !body.confirm_sku || !body.expected_current_price_hash) return json({ error: "approved, confirm_sku, expected_current_price_hash required" }, 400);
  if (body.price_update_type !== "supplier_price") return json({ error: "price_update_type must be supplier_price" }, 400);
  const productId = getProductId(url.pathname);
  const product = await fetchProduct(productId, env);
  if (body.confirm_sku !== normalizeSku(product)) return json({ error: "SKU mismatch" }, 409);
  const selRes = selectProductSupplier(product, body.product_supplier_id);
  if (selRes.error) return json({ error: selRes.error }, 409);
  const selected = selRes.selected;
  const oldHash = await computePriceHash(product, selected);
  if (oldHash !== body.expected_current_price_hash) return json({ error: "Current price changed", current_price_hash: oldHash }, 409);
  const newPrice = Number(body.supplier_price);
  if (!Number.isFinite(newPrice) || newPrice < 0) return json({ error: "supplier_price must be a nonnegative number" }, 400);
  const oldPrice = toNumberOrNull(selected.price ?? selected.supply_price ?? selected.supplier_price);
  const oldCode = selected.code || selected.supplier_code || null;
  const newCode = Object.prototype.hasOwnProperty.call(body, "supplier_code") ? body.supplier_code : oldCode;
  let auditId;
  try {
    auditId = await insertPriceHistory(env, { action_type: "update", status: "pending", product_id: stringOrNull(product.id || productId), sku: stringOrNull(normalizeSku(product)), product_name: stringOrNull(product.name), brand: brandName(product), handle: stringOrNull(product.handle), price_update_type: "supplier_price", price_scope: "product_supplier", old_supplier_price: numberOrNull(oldPrice), new_supplier_price: numberOrNull(newPrice), old_supplier_code: stringOrNull(oldCode), new_supplier_code: stringOrNull(newCode), product_supplier_id: stringOrNull(selected.id), supplier_id: stringOrNull(selected.supplier_id), supplier_name: stringOrNull(selected.supplier_name), supplier_code: stringOrNull(newCode), approved: true, approved_by: body.approved_by, approval_note: body.approval_note, expected_current_price_hash: body.expected_current_price_hash, old_price_hash: oldHash, new_price_hash: null, lightspeed_status: "pending", request_json: body, result_json: {} });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const payload = { details: { product_suppliers: [{ id: selected.id, supplier_id: selected.supplier_id, price: newPrice, code: newCode }] } };
    const result = await fetch(`${lsBase(env)}/api/2026-04/products/${product.id || productId}`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify(payload) });
    if (!result.ok) throw new Error(`Lightspeed update failed ${result.status}`);
    const data = await result.json();
    const fresh = await fetchProduct(product.id || productId, env);
    const freshSel = selectProductSupplier(fresh, selected.id).selected || selected;
    const newHash = await computePriceHash(fresh, freshSel);
    await updatePriceHistory(env, auditId, "success", "updated", data, newHash);
    return json({ ok: true, action: "supplier price updated", price_audit_id: auditId, old_supplier_price: numberOrNull(oldPrice), new_supplier_price: numberOrNull(newPrice), old_price_hash: oldHash, new_price_hash: newHash });
  } catch (err) {
    await updatePriceHistory(env, auditId, "failed", "failed", { error: String(err) });
    throw err;
  }
}

async function pricingHistory(url, env) { const productId = getProductId(url.pathname); const r = await env.DB.prepare("SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 200").bind(String(productId)).all(); return json(r.results || []); }
async function pricingRollbackPreview(request, url, env) {
  const body = await request.json();
  if (!body.history_id) return json({ error: "history_id required" }, 400);
  const row = await env.DB.prepare("SELECT * FROM price_history WHERE id = ? AND status = 'success'").bind(body.history_id).first();
  if (!row) return json({ error: "Successful history entry not found" }, 404);
  const product = await fetchProduct(getProductId(url.pathname), env);
  if (body.confirm_sku && body.confirm_sku !== normalizeSku(product)) return json({ error: "SKU mismatch" }, 409);
  const selRes = selectProductSupplier(product, row.product_supplier_id);
  if (selRes.error) return json({ error: selRes.error }, 409);
  const currentHash = await computePriceHash(product, selRes.selected);
  return json({ preview_only: true, history_id: row.id, product_id: String(product.id), current_price_hash: currentHash, target_old_supplier_price: row.old_supplier_price, target_old_supplier_code: row.old_supplier_code });
}
async function pricingRollbackApply(request, url, env) {
  if (!isWriteEnabled(env)) return json({ error: "Write disabled" }, 403);
  const body = await request.json();
  if (!body.approved || !body.history_id || !body.confirm_sku || !body.expected_current_price_hash) return json({ error: "approved, history_id, confirm_sku, expected_current_price_hash required" }, 400);
  const row = await env.DB.prepare("SELECT * FROM price_history WHERE id = ? AND status='success'").bind(body.history_id).first();
  if (!row) return json({ error: "Successful history entry not found" }, 404);
  const product = await fetchProduct(getProductId(url.pathname), env);
  if (body.confirm_sku !== normalizeSku(product)) return json({ error: "SKU mismatch" }, 409);
  const selRes = selectProductSupplier(product, row.product_supplier_id);
  if (selRes.error) return json({ error: selRes.error }, 409);
  const currentHash = await computePriceHash(product, selRes.selected);
  if (currentHash !== body.expected_current_price_hash) return json({ error: "Current price changed", current_price_hash: currentHash }, 409);
  let auditId;
  try {
    auditId = await insertPriceHistory(env, { action_type: "rollback", status: "pending", rollback_of_id: stringOrNull(row.id), product_id: stringOrNull(product.id), sku: stringOrNull(normalizeSku(product)), product_name: stringOrNull(product.name), brand: brandName(product), handle: stringOrNull(product.handle), price_update_type: "supplier_price", price_scope: "product_supplier", old_supplier_price: numberOrNull(selRes.selected.price ?? selRes.selected.supply_price ?? selRes.selected.supplier_price), new_supplier_price: numberOrNull(row.old_supplier_price), old_supplier_code: stringOrNull(selRes.selected.code || selRes.selected.supplier_code || null), new_supplier_code: stringOrNull(row.old_supplier_code), product_supplier_id: stringOrNull(selRes.selected.id), supplier_id: stringOrNull(selRes.selected.supplier_id), supplier_name: stringOrNull(selRes.selected.supplier_name), supplier_code: stringOrNull(row.old_supplier_code), approved: true, approved_by: body.approved_by, approval_note: body.approval_note, expected_current_price_hash: body.expected_current_price_hash, old_price_hash: currentHash, new_price_hash: null, lightspeed_status: "pending", request_json: body, result_json: {} });
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const payload = { details: { product_suppliers: [{ id: selRes.selected.id, supplier_id: selRes.selected.supplier_id, price: Number(row.old_supplier_price), code: row.old_supplier_code }] } };
    const resp = await fetch(`${lsBase(env)}/api/2026-04/products/${product.id}`, { method: "PUT", headers: lsHeaders(env, true), body: JSON.stringify(payload) });
    if (!resp.ok) throw new Error(`Lightspeed rollback failed ${resp.status}`);
    const data = await resp.json();
    const fresh = await fetchProduct(product.id, env);
    const freshSel = selectProductSupplier(fresh, selRes.selected.id).selected || selRes.selected;
    const newHash = await computePriceHash(fresh, freshSel);
    await updatePriceHistory(env, auditId, "success", "rolled_back", data, newHash);
    return json({ ok: true, action: "supplier price updated", price_audit_id: auditId, rollback_of_id: row.id, old_price_hash: currentHash, new_price_hash: newHash });
  } catch (err) { await updatePriceHistory(env, auditId, "failed", "failed", { error: String(err) }); throw err; }
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
  const items = products.map((p) => {
    const brand = (p.brand_name || p.brand || "").trim();
    const template_slug = normalizeBrandSlug(brand);
    return { id: p.id, sku: p.sku || null, name: p.name || null, brand: brand || null, template_slug: brand ? template_slug : null, missing_description: !(p.description || "").trim(), short_description: (p.description || "").replace(/<[^>]*>/g, "").trim().length < 120, placeholder_image: !p.image_url || /placeholder|no-image/i.test(p.image_url), webstore_disabled: p.published === false || p.webstore === false, no_brand: !brand, no_category: !(p.category_name || p.category), template_ready: Boolean(brand) };
  });
  const filtered = items.filter((x) => {
    if (report === "missing-descriptions") return x.missing_description;
    if (report === "short-descriptions") return x.short_description;
    if (report === "placeholder-images") return x.placeholder_image;
    if (report === "webstore-disabled") return x.webstore_disabled;
    if (report === "no-brand") return x.no_brand;
    if (report === "no-category") return x.no_category;
    if (report === "template-ready") return x.template_ready;
    return x.missing_description || x.short_description || x.placeholder_image || x.webstore_disabled || x.no_brand || x.no_category;
  });
  return json({ source: "lightspeed", report_type: report, scan: { scanned: products.length, scan_limit: scanLimit }, template_lookup: { strategy: "normalized-brand-slug", repo_path: "brand-templates/brands/{slug}.html" }, counts: { missing_descriptions: items.filter((x) => x.missing_description).length, short_descriptions: items.filter((x) => x.short_description).length, placeholder_images: items.filter((x) => x.placeholder_image).length, webstore_disabled: items.filter((x) => x.webstore_disabled).length, no_brand: items.filter((x) => x.no_brand).length, no_category: items.filter((x) => x.no_category).length, template_ready: items.filter((x) => x.template_ready).length }, data_count: filtered.length, data: filtered.slice(0, Number(url.searchParams.get("limit") || 100)) });
}




function brandName(product) {
  if (!product) return null;
  if (product.brand_name) return String(product.brand_name);
  if (product.brand && typeof product.brand === "object" && product.brand.name) return String(product.brand.name);
  if (typeof product.brand === "string") return product.brand;
  return null;
}
function stringOrNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  const text = String(value);
  return text.length ? text : null;
}
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function unwrapProductResponse(obj) { return obj && obj.data ? obj.data : obj && obj.product ? obj.product : obj || {}; }
function normalizeSku(product) { return product.sku || product.customSku || ""; }
function toNumberOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function productCodes(product) {
  const candidates = [];
  const pushIfString = (v) => { if (typeof v === "string" && v.trim()) candidates.push(v.trim()); };
  pushIfString(product.code);
  pushIfString(product.product_code);
  pushIfString(product.customSku);
  if (Array.isArray(product.codes)) product.codes.forEach((v) => pushIfString(v && (v.code || v.value || v)));
  return candidates;
}
function skuMatchesProduct(product, confirmSku) {
  const normalizedConfirm = String(confirmSku || "").trim();
  if (!normalizedConfirm) return false;
  if (normalizedConfirm === normalizeSku(product)) return true;
  return productCodes(product).some((code) => code === normalizedConfirm);
}
function supplierList(product) {
  if (Array.isArray(product.product_suppliers)) return product.product_suppliers;
  if (Array.isArray(product.productSuppliers)) return product.productSuppliers;
  if (Array.isArray(product.ProductSuppliers)) return product.ProductSuppliers;
  return [];
}
function selectProductSupplier(product, requestedId) {
  const list = supplierList(product);
  if (!list.length) return { error: "No product_suppliers found" };
  if (requestedId) {
    const found = list.find((x) => String(x.id) === String(requestedId));
    if (!found) return { error: "product_supplier_id not found on product" };
    return { selected: found };
  }
  if (list.length === 1) return { selected: list[0] };
  return { error: "product_supplier_id required when multiple product_suppliers exist" };
}
async function computePriceHash(product, sel) {
  const payload = {
    product_id: String(product.id || ""),
    sku: stringOrNull(normalizeSku(product)),
    product_supplier_id: String(sel.id || ""),
    supplier_id: String(sel.supplier_id || ""),
    supplier_price: toNumberOrNull(sel.price ?? sel.supply_price ?? sel.supplier_price),
    supplier_code: sel.code || sel.supplier_code || null,
    price_excluding_tax: toNumberOrNull(product.price_excluding_tax),
    price_including_tax: toNumberOrNull(product.price_including_tax),
  };
  return sha256Hex(JSON.stringify(payload));
}
async function insertPriceHistory(env, entry) {
  const id = crypto.randomUUID();
  const q = `INSERT INTO price_history (id,created_at,action_type,status,product_id,sku,product_name,brand,handle,price_update_type,price_scope,old_supplier_price,new_supplier_price,old_supplier_code,new_supplier_code,product_supplier_id,supplier_id,supplier_name,approved,approved_by,approval_note,expected_current_price_hash,old_price_hash,new_price_hash,lightspeed_status,bridge_version,request_json,result_json,rollback_of_id) VALUES (?,datetime('now'),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const requestJson = (() => { try { return JSON.stringify(entry.request_json ?? {}); } catch { return JSON.stringify({}); } })();
  const resultJson = (() => { try { return JSON.stringify(entry.result_json ?? {}); } catch { return JSON.stringify({}); } })();
  try {
    await env.DB.prepare(q).bind(
      id,
      stringOrNull(entry.action_type),
      stringOrNull(entry.status),
      stringOrNull(entry.product_id),
      stringOrNull(entry.sku),
      stringOrNull(entry.product_name),
      stringOrNull(entry.brand),
      stringOrNull(entry.handle),
      stringOrNull(entry.price_update_type),
      stringOrNull(entry.price_scope),
      numberOrNull(entry.old_supplier_price),
      numberOrNull(entry.new_supplier_price),
      stringOrNull(entry.old_supplier_code),
      stringOrNull(entry.new_supplier_code),
      stringOrNull(entry.product_supplier_id),
      stringOrNull(entry.supplier_id),
      stringOrNull(entry.supplier_name),
      entry.approved ? 1 : 0,
      stringOrNull(entry.approved_by),
      stringOrNull(entry.approval_note),
      stringOrNull(entry.expected_current_price_hash),
      stringOrNull(entry.old_price_hash),
      stringOrNull(entry.new_price_hash),
      stringOrNull(entry.lightspeed_status),
      BRIDGE_VERSION,
      requestJson,
      resultJson,
      stringOrNull(entry.rollback_of_id),
    ).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw json({ error: "Price audit insert failed", detail: msg, hint: "A non-primitive value may have been passed to D1" }, 500);
  }
  return id;
}
async function updatePriceHistory(env, id, status, lightspeedStatus, resultJson, newPriceHash = null) {
  await env.DB.prepare("UPDATE price_history SET status=?, lightspeed_status=?, result_json=?, new_price_hash=? WHERE id=?").bind(status, lightspeedStatus, JSON.stringify(resultJson || {}), newPriceHash, id).run();
}

function normalizeBrandSlug(brand) {
  const normalized = String(brand || "").trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const aliases = {
    "jofran inc": "jofran",
    jofran: "jofran",
    "hillsdale furniture": "hillsdale",
    "best home furnishngs": "best-home-furnishings",
    liberty: "liberty",
    aamerica: "a-america",
  };
  if (aliases[normalized]) return aliases[normalized];
  return normalized.replace(/\s+/g, "-");
}
