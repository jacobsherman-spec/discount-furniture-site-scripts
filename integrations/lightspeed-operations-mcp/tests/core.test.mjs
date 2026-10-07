import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryAuditStore } from "../src/audit-store.mjs";
import { LightspeedOperationsClient, OperationsError } from "../src/core.mjs";

function jsonResponse(value, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
    headers: status === 204 ? {} : { "content-type": "application/json", etag: `W/\"${status}\"` },
  });
}

function client(overrides = {}) {
  return new LightspeedOperationsClient({
    domainPrefix: "discountfurniture",
    token: "mock-token",
    signingKey: "mock-signing-key",
    auditStore: new MemoryAuditStore(),
    writesEnabled: true,
    fetchImpl: async () => jsonResponse({ ok: true }),
    ...overrides,
  });
}

test("catalog exposes the fixed operation set and inventory cautions", () => {
  const result = client().capabilities();
  assert.equal(result.operation_count, 201);
  assert.equal(result.read_count, 107);
  assert.equal(result.write_count, 94);
  assert.match(result.cautions.inventory_levels, /available-to-sell/i);
  assert.match(result.cautions.inventory_records, /physical stock/i);
  assert.equal(result.operations.some((entry) => entry.operation_id === "CreateStockAdjustments"), true);
  assert.equal(result.operations.some((entry) => entry.operation_id === "UpdateSale"), true);
  assert.equal(result.operations.some((entry) => entry.operation_id === "SetCustomFieldValues"), true);
  assert.equal(result.operations.some((entry) => entry.operation_id === "create-remote-rule"), false);
  assert.deepEqual(
    result.operations.find((entry) => entry.operation_id === "GetProductByID").scopes,
    ["products:read", "products:read:costs"],
  );
  assert.deepEqual(
    result.operations.find((entry) => entry.operation_id === "UpdateProduct202610").scopes,
    ["products:write", "products:write:costs"],
  );
});

test("unknown operations cannot reach the network", async () => {
  let calls = 0;
  const operations = client({ fetchImpl: async () => { calls += 1; throw new Error("must not run"); } });
  await assert.rejects(() => operations.read({ operation_id: "ArbitraryUrlProxy" }), /unknown or unsupported/i);
  assert.equal(calls, 0);
});

test("referenced purchase-order path parameters work and required queries are enforced", async () => {
  const urls = [];
  const operations = client({
    fetchImpl: async (url) => {
      urls.push(String(url));
      return jsonResponse({ id: "po-123" });
    },
  });
  const read = await operations.read({
    operation_id: "GetPurchaseOrderByID",
    path_parameters: { purchase_order_id: "po-123" },
  });
  assert.equal(read.result.status, 200);
  assert.match(urls[0], /\/purchase_orders\/po-123$/);
  await assert.rejects(() => operations.read({ operation_id: "Search", query: {} }), /required query parameter: type/i);
  assert.equal(urls.length, 1);
});

test("preview performs only a baseline read and execute reloads after writing", async () => {
  let product = { id: "p1", name: "Before", version: 1 };
  const methods = [];
  const auditStore = new MemoryAuditStore();
  const operations = client({
    auditStore,
    fetchImpl: async (_url, init = {}) => {
      const method = init.method || "GET";
      methods.push(method);
      if (method === "GET") return jsonResponse(product);
      if (method === "PATCH") {
        product = { ...product, ...JSON.parse(init.body), version: 2 };
        return jsonResponse(product);
      }
      throw new Error(`Unexpected method ${method}`);
    },
  });

  const preview = await operations.preview({
    operation_id: "UpdateProduct202610",
    path_parameters: { product_id: "p1" },
    body: { name: "After" },
  });
  assert.equal(preview.write_executed, false);
  assert.deepEqual(methods, ["GET"]);

  const executed = await operations.execute({
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Update product p1 name as requested",
  });
  assert.equal(executed.write_executed, true);
  assert.equal(executed.verification_passed, true);
  assert.deepEqual(methods, ["GET", "GET", "PATCH", "GET"]);
  assert.equal(auditStore.rows.get(executed.audit_id).status, "success");
});

test("tampered and expired receipts cannot execute", async () => {
  let now = 1_800_000_000_000;
  let patchCalls = 0;
  const operations = client({
    now: () => now,
    fetchImpl: async (_url, init = {}) => {
      if ((init.method || "GET") === "PATCH") patchCalls += 1;
      return jsonResponse({ id: "p1", version: 1 });
    },
  });
  const preview = await operations.preview({
    operation_id: "UpdateProduct202610",
    path_parameters: { product_id: "p1" },
    body: { name: "After" },
  });
  const last = preview.preview_receipt.at(-1);
  const tampered = `${preview.preview_receipt.slice(0, -1)}${last === "A" ? "B" : "A"}`;
  await assert.rejects(() => operations.execute({
    preview_receipt: tampered,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Attempt tampered receipt for safety test",
  }), /signature is invalid/i);

  now += 16 * 60 * 1000;
  await assert.rejects(() => operations.execute({
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Attempt expired receipt for safety test",
  }), /expired/i);
  assert.equal(patchCalls, 0);
});

test("baseline drift blocks execution before a write", async () => {
  let product = { id: "p1", version: 1 };
  let patchCalls = 0;
  const operations = client({
    fetchImpl: async (_url, init = {}) => {
      if ((init.method || "GET") === "PATCH") patchCalls += 1;
      return jsonResponse(product);
    },
  });
  const preview = await operations.preview({
    operation_id: "UpdateProduct202610",
    path_parameters: { product_id: "p1" },
    body: { name: "After" },
  });
  product = { id: "p1", version: 2, changed_elsewhere: true };
  await assert.rejects(() => operations.execute({
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Update only if the baseline is unchanged",
  }), (error) => error instanceof OperationsError && error.status === 409);
  assert.equal(patchCalls, 0);
});

test("exclusive audit reservation makes create receipts non-repeatable", async () => {
  let postCalls = 0;
  const operations = client({
    fetchImpl: async (_url, init = {}) => {
      if (init.method === "POST") postCalls += 1;
      return jsonResponse({ id: "family-1" }, 201);
    },
  });
  const preview = await operations.preview({
    operation_id: "CreateProductFamily202610",
    body: { name: "Mock family", type: "standard" },
  });
  const execution = {
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Create the specifically requested mock family",
  };
  const first = await operations.execute(execution);
  assert.equal(first.verification_passed, false);
  assert.match(first.verification_note, /follow-up read/i);
  await assert.rejects(() => operations.execute(execution), /already used/i);
  assert.equal(postCalls, 1);
});

test("delete verification requires a 404 or 410 resource reload", async () => {
  let deleted = false;
  const operations = client({
    fetchImpl: async (_url, init = {}) => {
      const method = init.method || "GET";
      if (method === "GET") return deleted ? jsonResponse({ error: "not found" }, 404) : jsonResponse({ id: "p1" });
      if (method === "DELETE") { deleted = true; return jsonResponse(null, 204); }
      throw new Error(`Unexpected method ${method}`);
    },
  });
  const preview = await operations.preview({
    operation_id: "DeleteProduct202610",
    path_parameters: { product_id: "p1" },
  });
  const result = await operations.execute({
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "Delete the specifically requested product p1",
  });
  assert.equal(result.verification_passed, true);
});

test("writes require the local write flag and an audit store", async () => {
  const disabled = client({ writesEnabled: false });
  const preview = await disabled.preview({
    operation_id: "CreateProductFamily202610",
    body: { name: "Mock family", type: "standard" },
  });
  await assert.rejects(() => disabled.execute({
    preview_receipt: preview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "This must be blocked by configuration",
  }), /writes are disabled/i);

  const noAudit = client({ auditStore: null });
  const secondPreview = await noAudit.preview({
    operation_id: "CreateProductFamily202610",
    body: { name: "Mock family", type: "standard" },
  });
  await assert.rejects(() => noAudit.execute({
    preview_receipt: secondPreview.preview_receipt,
    approved: true,
    approved_by: "Jacob",
    approval_note: "This must be blocked without audit storage",
  }), /audit reservation is not configured/i);
});
