const VERSION = "0.1.0";

const ALLOWED_REPORT_TYPES = new Set([
  "product-cleanup-summary",
  "missing-descriptions",
  "short-descriptions",
  "placeholder-images",
  "webstore-disabled",
  "no-brand",
  "no-category",
  "template-ready",
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

function getField(body, ...names) {
  for (const name of names) {
    if (body && Object.prototype.hasOwnProperty.call(body, name)) return body[name];
  }
  return undefined;
}

function asNonNegativeNumber(value) {
  if (value === undefined || value === null || value === "") return { present: false };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { present: true, valid: false };
  return { present: true, valid: true, value: n };
}

function validateAuth(req, env) {
  const auth = req.headers.get("Authorization") || "";
  const expected = env.FACADE_API_KEY;
  if (!expected) return { ok: false, status: 500, error: "Server misconfigured: missing FACADE_API_KEY" };
  if (!auth.startsWith("Bearer ")) return { ok: false, status: 401, error: "Missing Bearer token" };
  const token = auth.slice("Bearer ".length).trim();
  if (token !== expected) return { ok: false, status: 403, error: "Invalid API key" };
  return { ok: true };
}

async function callBridge(env, method, path, body, query) {
  if (!env.INTERNAL_BRIDGE_API_KEY) {
    return {
      ok: false,
      status: 500,
      data: { error: "Server misconfigured: missing INTERNAL_BRIDGE_API_KEY" }
    };
  }

  const internalBase = "https://internal-bridge.local";
  const internalUrl = new URL(path, internalBase);

  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        internalUrl.searchParams.set(k, String(v));
      }
    });
  }

  const headers = {
    "Authorization": `Bearer ${env.INTERNAL_BRIDGE_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "DiscountFurnitureGPTFacade/2026-05-01"
  };

  let res;

  try {
    if (env.INTERNAL_BRIDGE_SERVICE) {
      res = await env.INTERNAL_BRIDGE_SERVICE.fetch(new Request(internalUrl.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      }));
    } else {
      const base = String(env.INTERNAL_BRIDGE_URL || "").replace(/\/+$/, "");

      if (!base) {
        return {
          ok: false,
          status: 500,
          data: { error: "Server misconfigured: missing INTERNAL_BRIDGE_URL and INTERNAL_BRIDGE_SERVICE" }
        };
      }

      const fallbackUrl = new URL(path, base);

      if (query) {
        Object.entries(query).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            fallbackUrl.searchParams.set(k, String(v));
          }
        });
      }

      res = await fetch(fallbackUrl.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    }
  } catch (error) {
    return {
      ok: false,
      status: 502,
      data: { error: "Failed to reach internal bridge", detail: String(error) }
    };
  }

  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    data
  };
}

function bridgeResponse(result) {
  return jsonResponse(result.data, result.status);
}

async function handleRead(body, env) {
  const action = getField(body, "action", "readAction", "read_action");
  if (!action) return jsonResponse({ error: "Missing required field: action" }, 400);

  switch (action) {
    case "searchProducts":
      return bridgeResponse(await callBridge(env, "GET", "/products/search", null, {
        q: getField(body, "q", "query", "search", "searchTerm", "search_term"),
        sku: getField(body, "sku"),
        limit: getField(body, "limit"),
        offset: getField(body, "offset"),
      }));
    case "getProductById": {
      const productId = getField(body, "productId", "product_id");
      if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}`));
    }
    case "getProductInventory": {
      const productId = getField(body, "productId", "product_id");
      if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}/inventory`));
    }
    case "getProductInventoryLevels": {
      const productId = getField(body, "productId", "product_id");
      if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}/inventory-levels`));
    }
    case "listBrands": return bridgeResponse(await callBridge(env, "GET", "/brands"));
    case "listSuppliers": return bridgeResponse(await callBridge(env, "GET", "/suppliers"));
    case "listOutlets": return bridgeResponse(await callBridge(env, "GET", "/outlets"));
    case "listGitHubBrandTemplates": return bridgeResponse(await callBridge(env, "GET", "/templates/brands"));
    case "getGitHubBrandTemplate":
      return bridgeResponse(await callBridge(env, "GET", "/templates/brand", null, { brand: getField(body, "brand", "brandName", "brand_name") }));
    case "getGitHubTemplateRegistry": return bridgeResponse(await callBridge(env, "GET", "/templates/registry"));
    case "getGitHubTemplateReadme": return bridgeResponse(await callBridge(env, "GET", "/templates/readme"));
    case "listGitHubBrandAssets": return bridgeResponse(await callBridge(env, "GET", "/templates/assets"));
    case "getGitHubTemplateFile":
      return bridgeResponse(await callBridge(env, "GET", "/templates/file", null, { path: getField(body, "path", "filePath", "file_path") }));
    case "getGptOperatingManual":
      return bridgeResponse(await callBridge(env, "GET", "/templates/file", null, { path: "gpt-operating-manuals/discount-furniture-gpt-manual.md" }));
    case "catalogReport": {
      const reportType = getField(body, "reportType", "report_type");
      if (!reportType) return jsonResponse({ error: "Missing required field: reportType" }, 400);
      if (!ALLOWED_REPORT_TYPES.has(reportType)) return jsonResponse({ error: "Invalid reportType", valid_report_types: Array.from(ALLOWED_REPORT_TYPES) }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/reports/${encodeURIComponent(reportType)}`));
    }
    case "auditHealth": return bridgeResponse(await callBridge(env, "GET", "/audit/health"));
    case "listDescriptionUpdates": return bridgeResponse(await callBridge(env, "GET", "/description-updates"));
    case "getDescriptionUpdate": {
      const historyId = getField(body, "historyId", "history_id");
      if (!historyId) return jsonResponse({ error: "Missing required field: historyId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/description-updates/${encodeURIComponent(historyId)}`));
    }
    case "getProductDescriptionHistory": {
      const productId = getField(body, "productId", "product_id");
      if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}/description/history`));
    }
    case "getProductPricingHistory": {
      const productId = getField(body, "productId", "product_id");
      if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
      return bridgeResponse(await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}/pricing/history`, null, {
        limit: getField(body, "limit"),
      }));
    }
    default:
      return jsonResponse({ error: "Unknown read action", action }, 400);
  }
}

async function handlePreview(body, env) {
  const type = getField(body, "type", "previewType", "preview_type");
  if (!type) return jsonResponse({ error: "Missing required field: type" }, 400);

  if (type === "description_update") {
    const productId = getField(body, "productId", "product_id");
    const html = getField(body, "html");
    if (!productId || !html) return jsonResponse({ error: "Missing required fields: productId and html" }, 400);
    const payload = {
      html,
      confirm_sku: getField(body, "confirm_sku", "confirmSku"),
      allow_family_update: getField(body, "allow_family_update", "allowFamilyUpdate"),
    };
    return bridgeResponse(await callBridge(env, "POST", `/products/${encodeURIComponent(productId)}/description/preview`, payload));
  }

  if (type === "description_rollback") {
    const productId = getField(body, "productId", "product_id");
    if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
    const payload = {
      history_id: getField(body, "history_id", "historyId"),
      confirm_sku: getField(body, "confirm_sku", "confirmSku"),
      allow_family_update: getField(body, "allow_family_update", "allowFamilyUpdate"),
    };
    return bridgeResponse(await callBridge(env, "POST", `/products/${encodeURIComponent(productId)}/description/rollback/preview`, payload));
  }

  if (type === "pricing_update") {
    const productId = getField(body, "productId", "product_id");
    if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
    const payload = {
      confirm_sku: getField(body, "confirm_sku", "confirmSku"),
      price_update_type: getField(body, "price_update_type", "priceUpdateType"),
      supplier_price: getField(body, "supplier_price", "supplierPrice"),
      supplier_code: getField(body, "supplier_code", "supplierCode"),
      product_supplier_id: getField(body, "product_supplier_id", "productSupplierId"),
      supplier_id: getField(body, "supplier_id", "supplierId"),
      retail_price: getField(body, "retail_price", "retailPrice"),
      price_book_id: getField(body, "price_book_id", "priceBookId"),
      price_book_product_id: getField(body, "price_book_product_id", "priceBookProductId"),
    };
    return bridgeResponse(await callBridge(env, "POST", `/products/${encodeURIComponent(productId)}/pricing/preview`, payload));
  }

  if (type === "pricing_rollback") {
    const productId = getField(body, "productId", "product_id");
    if (!productId) return jsonResponse({ error: "Missing required field: productId" }, 400);
    const payload = { history_id: getField(body, "history_id", "historyId"), confirm_sku: getField(body, "confirm_sku", "confirmSku") };
    return bridgeResponse(await callBridge(env, "POST", `/products/${encodeURIComponent(productId)}/pricing/rollback/preview`, payload));
  }

  if (type === "price_list_import") {
    const payload = {
      type: "price_list_import",
      supplier_name: getField(body, "supplier_name", "supplierName"),
      file_name: getField(body, "file_name", "fileName"),
      created_by: getField(body, "created_by", "createdBy"),
      rows: getField(body, "rows"),
      options: getField(body, "options"),
    };
    return bridgeResponse(await callBridge(env, "POST", "/imports/price-list/preview", payload));
  }


  return jsonResponse({ error: "Unknown preview type", type }, 400);
}

async function handleWrite(body, env) {
  const type = getField(body, "type", "writeType", "write_type");
  const approved = getField(body, "approved");
  if (!type) return jsonResponse({ error: "Missing required field: type" }, 400);
  if (approved !== true) return jsonResponse({ error: "Missing required field: approved=true" }, 400);

  if (type === "pricing_update") {
    const productId = getField(body, "productId", "product_id");
    const confirmSku = getField(body, "confirm_sku", "confirmSku");
    const expectedHash = getField(body, "expected_current_price_hash", "expectedCurrentPriceHash");
    if (!productId || !confirmSku || !expectedHash) return jsonResponse({ error: "Missing required fields: productId, confirm_sku, expected_current_price_hash" }, 400);
    const payload = {
      approved: true,
      confirm_sku: confirmSku,
      expected_current_price_hash: expectedHash,
      price_update_type: getField(body, "price_update_type", "priceUpdateType"),
      supplier_price: getField(body, "supplier_price", "supplierPrice"),
      supplier_code: getField(body, "supplier_code", "supplierCode"),
      product_supplier_id: getField(body, "product_supplier_id", "productSupplierId"),
      supplier_id: getField(body, "supplier_id", "supplierId"),
      retail_price: getField(body, "retail_price", "retailPrice"),
      price_book_id: getField(body, "price_book_id", "priceBookId"),
      price_book_product_id: getField(body, "price_book_product_id", "priceBookProductId"),
      approved_by: getField(body, "approved_by", "approvedBy"),
      approval_note: getField(body, "approval_note", "approvalNote"),
    };
    return bridgeResponse(await callBridge(env, "PUT", `/products/${encodeURIComponent(productId)}/pricing`, payload));
  }

  if (type === "pricing_rollback") {
    const productId = getField(body, "productId", "product_id");
    const historyId = getField(body, "history_id", "historyId");
    const confirmSku = getField(body, "confirm_sku", "confirmSku");
    const expectedHash = getField(body, "expected_current_price_hash", "expectedCurrentPriceHash");
    if (!productId || !historyId || !confirmSku || !expectedHash) return jsonResponse({ error: "Missing required fields: productId, history_id, confirm_sku, expected_current_price_hash" }, 400);
    const payload = { approved: true, history_id: historyId, confirm_sku: confirmSku, expected_current_price_hash: expectedHash, approved_by: getField(body, "approved_by", "approvedBy"), approval_note: getField(body, "approval_note", "approvalNote") };
    return bridgeResponse(await callBridge(env, "PUT", `/products/${encodeURIComponent(productId)}/pricing/rollback`, payload));
  }

  if (type === "description_update") {
    const productId = getField(body, "productId", "product_id");
    const html = getField(body, "html");
    const confirmSku = getField(body, "confirm_sku", "confirmSku");
    const expectedSha = getField(body, "expected_current_description_sha256", "expectedCurrentDescriptionSha256");
    if (!productId || !html || !confirmSku || !expectedSha) {
      return jsonResponse({ error: "Missing required fields: productId, html, confirm_sku, expected_current_description_sha256" }, 400);
    }
    const payload = {
      html,
      approved: true,
      confirm_sku: confirmSku,
      expected_current_description_sha256: expectedSha,
      allow_family_update: getField(body, "allow_family_update", "allowFamilyUpdate"),
      approved_by: getField(body, "approved_by", "approvedBy"),
      approval_note: getField(body, "approval_note", "approvalNote"),
      source_urls: getField(body, "source_urls", "sourceUrls"),
    };
    return bridgeResponse(await callBridge(env, "PUT", `/products/${encodeURIComponent(productId)}/description`, payload));
  }

  if (type === "description_rollback") {
    const productId = getField(body, "productId", "product_id");
    const historyId = getField(body, "history_id", "historyId");
    const confirmSku = getField(body, "confirm_sku", "confirmSku");
    const expectedSha = getField(body, "expected_current_description_sha256", "expectedCurrentDescriptionSha256");
    if (!productId || !historyId || !confirmSku || !expectedSha) {
      return jsonResponse({ error: "Missing required fields: productId, history_id, confirm_sku, expected_current_description_sha256" }, 400);
    }
    const payload = {
      history_id: historyId,
      approved: true,
      confirm_sku: confirmSku,
      expected_current_description_sha256: expectedSha,
      allow_family_update: getField(body, "allow_family_update", "allowFamilyUpdate"),
      approved_by: getField(body, "approved_by", "approvedBy"),
      approval_note: getField(body, "approval_note", "approvalNote"),
    };
    return bridgeResponse(await callBridge(env, "PUT", `/products/${encodeURIComponent(productId)}/description/rollback`, payload));
  }

  if (type === "price_list_import") {
    const batchId = getField(body, "batch_id", "batchId");
    if (!batchId) return jsonResponse({ error: "Missing required field: batch_id" }, 400);
    const payload = {
      type: "price_list_import",
      approved: true,
      batch_id: batchId,
      approved_rows: getField(body, "approved_rows", "approvedRows"),
      approved_row_ids: getField(body, "approved_row_ids", "approvedRowIds"),
      approved_by: getField(body, "approved_by", "approvedBy"),
      approval_note: getField(body, "approval_note", "approvalNote"),
      supplier_name: getField(body, "supplier_name", "supplierName"),
      file_name: getField(body, "file_name", "fileName"),
      options: getField(body, "options"),
    };
    return bridgeResponse(await callBridge(env, "PUT", "/imports/price-list", payload));
  }

  return jsonResponse({ error: "Unknown write type", type }, 400);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "gpt-facade", version: VERSION });
    }

    const auth = validateAuth(request, env);
    if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status);

    let body = {};
    if (request.method !== "GET") {
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
    }

    if (request.method === "POST" && url.pathname === "/read") return handleRead(body, env);
    if (request.method === "POST" && url.pathname === "/preview") return handlePreview(body, env);
    if (request.method === "PUT" && url.pathname === "/write") return handleWrite(body, env);

    return jsonResponse({
      error: "Not found",
      allowed_routes: ["GET /health", "POST /read", "POST /preview", "PUT /write"],
    }, 404);
  }
};
