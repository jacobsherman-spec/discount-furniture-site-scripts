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
  if (!env.INTERNAL_BRIDGE_URL || !env.INTERNAL_BRIDGE_API_KEY) {
    return { ok: false, status: 500, data: { error: "Server misconfigured: missing INTERNAL_BRIDGE_URL or INTERNAL_BRIDGE_API_KEY" } };
  }

  const url = new URL(path, env.INTERNAL_BRIDGE_URL);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        "Authorization": `Bearer ${env.INTERNAL_BRIDGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    return { ok: false, status: 502, data: { error: "Failed to reach internal bridge", detail: String(error) } };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }

  return { ok: res.ok, status: res.status, data };
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
    default:
      return jsonResponse({ error: "Unknown read action", action }, 400);
  }
}

function bridgeResponse(result) { return jsonResponse(result.data, result.status); }

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

    const retail = asNonNegativeNumber(getField(body, "retail_price", "retailPrice"));
    const supplier = asNonNegativeNumber(getField(body, "supplier_price", "supplierPrice"));
    if ((retail.present && !retail.valid) || (supplier.present && !supplier.valid)) {
      return jsonResponse({ error: "retail_price and supplier_price must be nonnegative numbers when provided" }, 400);
    }

    const productRes = await callBridge(env, "GET", `/products/${encodeURIComponent(productId)}`);
    const product = productRes.data?.product || productRes.data;

    return jsonResponse({
      type,
      product_id: String(productId),
      current_pricing: {
        price_excluding_tax: product?.price_excluding_tax,
        price_including_tax: product?.price_including_tax,
        supply_price: product?.supply_price,
        product_suppliers: product?.product_suppliers,
      },
      requested_pricing: {
        retail_price: retail.present ? retail.value : getField(body, "retail_price", "retailPrice"),
        supplier_price: supplier.present ? supplier.value : getField(body, "supplier_price", "supplierPrice"),
        price_book_id: getField(body, "price_book_id", "priceBookId"),
        price_book_product_id: getField(body, "price_book_product_id", "priceBookProductId"),
        product_supplier_id: getField(body, "product_supplier_id", "productSupplierId"),
        supplier_id: getField(body, "supplier_id", "supplierId"),
        supplier_code: getField(body, "supplier_code", "supplierCode"),
      },
      can_update: false,
      pricing_write_enabled: false,
      message: "Pricing writes are blocked until price audit logging and scopes are implemented.",
      internal_product_lookup_status: productRes.status,
    }, productRes.ok ? 200 : productRes.status);
  }

  return jsonResponse({ error: "Unknown preview type", type }, 400);
}

async function handleWrite(body, env) {
  const type = getField(body, "type", "writeType", "write_type");
  const approved = getField(body, "approved");
  if (!type) return jsonResponse({ error: "Missing required field: type" }, 400);
  if (approved !== true) return jsonResponse({ error: "Missing required field: approved=true" }, 400);

  if (type === "pricing_update") return jsonResponse({ error: "Not Implemented", message: "Pricing writes are intentionally disabled for now." }, 501);

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

  return jsonResponse({ error: "Unknown write type", type }, 400);
}

export default {
async function internalFetch(env, method, path, body) {
  if (!env.INTERNAL_BRIDGE_API_KEY) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "Facade is missing INTERNAL_BRIDGE_API_KEY."
      }
    };
  }

  const headers = {
    "Authorization": `Bearer ${env.INTERNAL_BRIDGE_API_KEY}`,
    "Accept": "application/json",
    "User-Agent": `DiscountFurnitureGPTFacade/${FACADE_VERSION}`
  };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  let response;

  if (env.INTERNAL_BRIDGE_SERVICE) {
    const internalRequest = new Request(`https://internal-bridge.local${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    response = await env.INTERNAL_BRIDGE_SERVICE.fetch(internalRequest);
  } else {
    const base = String(env.INTERNAL_BRIDGE_URL || "").replace(/\/+$/, "");

    if (!base) {
      return {
        ok: false,
        status: 500,
        data: {
          error: "Facade is missing INTERNAL_BRIDGE_URL and INTERNAL_BRIDGE_SERVICE."
        }
      };
    }

    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}
