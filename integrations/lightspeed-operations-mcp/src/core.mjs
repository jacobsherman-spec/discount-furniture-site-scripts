import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  OPERATION_CATALOG,
  OPERATION_CATALOG_GENERATED_AT,
  OPERATION_CATALOG_SOURCE,
  OPERATION_CATALOG_VERSION,
} from "./operations-registry.js";
import { buildRequestedStatePlan, compareRequestedState } from "./expected-state.mjs";

const RECEIPT_VERSION = 1;
const RECEIPT_TTL_MS = 15 * 60 * 1000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 1024 * 1024;
const PATH_VALUE_RE = /^[A-Za-z0-9._:@+-]{1,256}$/;

export class OperationsError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.name = "OperationsError";
    this.status = status;
    this.details = details;
  }
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry) ?? "null").join(",")}]`;
  const entries = [];
  for (const key of Object.keys(value).sort()) {
    const encoded = stableStringify(value[key]);
    if (encoded !== undefined) entries.push(`${JSON.stringify(key)}:${encoded}`);
  }
  return `{${entries.join(",")}}`;
}

function sha256Hex(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function hmacBase64Url(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function operationFor(operationId, expectedEffect) {
  const operation = OPERATION_CATALOG[operationId];
  if (!operation) throw new OperationsError(`Unknown or unsupported operation_id: ${operationId || "(missing)"}`);
  if (expectedEffect && operation.effect !== expectedEffect) {
    throw new OperationsError(`Operation ${operation.operation_id} is ${operation.effect}; use the ${operation.effect} workflow`);
  }
  return operation;
}

function normalizePathParameters(operation, raw) {
  const supplied = raw === undefined ? {} : raw;
  if (!isPlainObject(supplied)) throw new OperationsError("path_parameters must be an object");
  const allowed = new Set(operation.path_parameters || []);
  for (const key of Object.keys(supplied)) {
    if (!allowed.has(key)) throw new OperationsError(`Unexpected path parameter for ${operation.operation_id}: ${key}`);
  }
  const normalized = {};
  for (const key of allowed) {
    const value = String(supplied[key] ?? "");
    if (!PATH_VALUE_RE.test(value)) throw new OperationsError(`Missing or invalid path parameter: ${key}`);
    normalized[key] = value;
  }
  return normalized;
}

function normalizeQuery(operation, raw) {
  const supplied = raw === undefined ? {} : raw;
  if (!isPlainObject(supplied)) throw new OperationsError("query must be an object");
  const allowed = new Set(operation.query_parameters || []);
  const normalized = {};
  for (const [key, value] of Object.entries(supplied)) {
    if (!allowed.has(key)) throw new OperationsError(`Unexpected query parameter for ${operation.operation_id}: ${key}`);
    if (value === undefined || value === null || value === "") continue;
    const values = Array.isArray(value) ? value : [value];
    if (values.length > 1000) throw new OperationsError(`Too many values for query parameter: ${key}`);
    normalized[key] = values.map((entry) => {
      if (!["string", "number", "boolean"].includes(typeof entry)) {
        throw new OperationsError(`Query parameter ${key} must contain only scalar values`);
      }
      return entry;
    });
  }
  for (const key of operation.required_query_parameters || []) {
    if (!normalized[key]?.length) throw new OperationsError(`Missing required query parameter: ${key}`);
  }
  return normalized;
}

function normalizeInput(raw, expectedEffect) {
  if (!isPlainObject(raw)) throw new OperationsError("Operation input must be an object");
  const operation = operationFor(String(raw.operation_id || ""), expectedEffect);
  const pathParameters = normalizePathParameters(operation, raw.path_parameters);
  const query = normalizeQuery(operation, raw.query);
  const hasBody = Object.prototype.hasOwnProperty.call(raw, "body") && raw.body !== undefined;
  if (hasBody && !operation.accepts_json_body) throw new OperationsError(`${operation.operation_id} does not accept a JSON body`);
  if (operation.body_required && !hasBody) throw new OperationsError(`${operation.operation_id} requires a JSON body`);
  if (hasBody && raw.body !== null && typeof raw.body !== "object") {
    throw new OperationsError("body must be a JSON object, array, or null");
  }
  if (hasBody && Buffer.byteLength(JSON.stringify(raw.body), "utf8") > MAX_BODY_BYTES) {
    throw new OperationsError(`body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  return { operation, path_parameters: pathParameters, query, body: hasBody ? raw.body : undefined };
}

function buildPath(operation, pathParameters) {
  let path = operation.path;
  for (const key of operation.path_parameters || []) {
    path = path.replace(`{${key}}`, encodeURIComponent(pathParameters[key]));
  }
  if (/\{[^}]+\}/.test(path)) throw new OperationsError(`Unresolved path parameter in ${operation.operation_id}`);
  return path;
}

function operationVerificationStrategy(operation) {
  if (!operation.baseline_operation_id) return "follow_up_read_required";
  const baselineOperation = OPERATION_CATALOG[operation.baseline_operation_id];
  if (operation.method === "DELETE" && !operation.body_required) return "resource_absent";
  if (["PATCH", "PUT"].includes(operation.method) && baselineOperation?.path === operation.path) {
    return "preview_mapped_requested_state";
  }
  return "follow_up_read_required";
}

function publicOperation(operation) {
  return {
    operation_id: operation.operation_id,
    api_version: operation.api_version,
    method: operation.method,
    path: operation.path,
    tag: operation.tag,
    summary: operation.summary,
    scopes: operation.scopes,
    path_parameters: operation.path_parameters,
    query_parameters: operation.query_parameters,
    required_query_parameters: operation.required_query_parameters || [],
    body_required: operation.body_required,
    effect: operation.effect,
    risk: operation.risk,
    lifecycle: operation.lifecycle,
    baseline_operation_id: operation.baseline_operation_id || null,
    verification_strategy: operationVerificationStrategy(operation),
  };
}

function baselineInputFor(operation, input) {
  if (!operation.baseline_operation_id) return null;
  const baselineOperation = operationFor(operation.baseline_operation_id, "read");
  const pathParameters = {};
  for (const key of baselineOperation.path_parameters || []) {
    if (!(key in input.path_parameters)) return null;
    pathParameters[key] = input.path_parameters[key];
  }
  return { operation: baselineOperation, path_parameters: pathParameters, query: {}, body: undefined };
}

function unsupportedPlan(reason) {
  return {
    strategy: "unsupported",
    supported: false,
    checked_root: null,
    reason,
  };
}

function unsupportedAssertion(reason) {
  return { ...unsupportedPlan(reason), matched: false, mismatch_paths: [] };
}

function expectedStatePlan(operation, body, baseline) {
  if (!baseline.available) {
    return unsupportedPlan("No deterministic resource reload is defined for this operation");
  }

  if (operation.method === "DELETE") {
    if (body !== undefined) {
      return unsupportedPlan("A collection-member deletion cannot be verified by requiring the collection resource to disappear");
    }
    return {
      strategy: "resource_absent",
      supported: true,
      checked_root: null,
      reason: "A resource reload can confirm that the deleted target is absent",
    };
  }

  const baselineOperation = operation.baseline_operation_id
    ? OPERATION_CATALOG[operation.baseline_operation_id]
    : null;
  if (!["PATCH", "PUT"].includes(operation.method) || baselineOperation?.path !== operation.path) {
    return unsupportedPlan("This operation does not reload the same resource that its request body modifies");
  }
  if (!baseline.response?.ok) {
    return unsupportedPlan(`Preview baseline returned HTTP ${baseline.response?.status ?? "unknown"}`);
  }
  return buildRequestedStatePlan(body, baseline.response.data);
}

function expectedStateAssertion(operation, plan, verification) {
  const verificationPlan = plan.verification_plan || expectedStatePlan(operation, plan.body, verification);
  if (!verification.available) {
    return unsupportedAssertion("No deterministic resource reload is defined for this operation");
  }

  if (!verificationPlan.supported) return { ...verificationPlan, matched: false, mismatch_paths: [] };

  if (operation.method === "DELETE") {
    const matched = [404, 410].includes(verification.response?.status);
    return {
      strategy: "resource_absent",
      supported: true,
      matched,
      checked_root: null,
      mismatch_paths: [],
      reason: matched ? "The resource reload confirmed deletion" : "The resource reload did not confirm deletion",
    };
  }

  if (!verification.response?.ok) {
    return {
      strategy: "requested_fields_exact_match",
      supported: true,
      matched: false,
      checked_root: null,
      mismatch_paths: [],
      reason: `Resource reload returned HTTP ${verification.response?.status ?? "unknown"}`,
    };
  }
  return compareRequestedState(plan.body, verification.response.data, verificationPlan);
}

function assessVerification(operation, plan, result, verification) {
  if (!result.ok) {
    return {
      passed: false,
      status: "write_failed",
      note: `Lightspeed returned HTTP ${result.status}`,
      assertion: null,
    };
  }

  const assertion = expectedStateAssertion(operation, plan, verification);
  if (assertion.matched) {
    return {
      passed: true,
      status: "success",
      note: assertion.reason,
      assertion,
    };
  }
  return {
    passed: false,
    status: "verification_required",
    note: `${assertion.reason}; perform a targeted follow-up read before treating the change as complete`,
    assertion,
  };
}

export class LightspeedOperationsClient {
  constructor(options = {}) {
    this.domainPrefix = String(options.domainPrefix || "").trim();
    if (!/^[a-z0-9-]+$/i.test(this.domainPrefix)) throw new Error("A valid Lightspeed retailer domain prefix is required");
    this.token = String(options.token || "");
    this.signingKey = String(options.signingKey || "");
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.auditStore = options.auditStore || null;
    this.writesEnabled = options.writesEnabled === true;
    this.now = options.now || (() => Date.now());
    this.uuid = options.uuid || (() => randomUUID());
  }

  capabilities(filters = {}) {
    const effect = filters.effect ? String(filters.effect) : null;
    const tag = filters.tag ? String(filters.tag).toLowerCase() : null;
    const search = filters.search ? String(filters.search).toLowerCase() : null;
    let operations = Object.values(OPERATION_CATALOG);
    if (effect) operations = operations.filter((entry) => entry.effect === effect);
    if (tag) operations = operations.filter((entry) => entry.tag.toLowerCase() === tag);
    if (search) {
      operations = operations.filter((entry) =>
        `${entry.operation_id} ${entry.tag} ${entry.summary} ${entry.path}`.toLowerCase().includes(search));
    }
    const publicOperations = operations.map(publicOperation);
    return {
      ok: true,
      catalog_version: OPERATION_CATALOG_VERSION,
      catalog_source: OPERATION_CATALOG_SOURCE,
      catalog_generated_at: OPERATION_CATALOG_GENERATED_AT,
      write_enabled: this.writesEnabled,
      operation_count: publicOperations.length,
      total_operation_count: Object.keys(OPERATION_CATALOG).length,
      read_count: publicOperations.filter((entry) => entry.effect === "read").length,
      write_count: publicOperations.filter((entry) => entry.effect === "write").length,
      operations: publicOperations,
      cautions: {
        inventory_levels: "current_inventory_level is available-to-sell; do not label it physical on-hand",
        inventory_records: "Use Inventory records for physical stock facts and do not aggregate composite parents with component quantities",
        sales_payments: "record access does not itself charge or refund a payment card",
        receipts: "receipt transmission is not implemented by this adapter",
        images: "multipart product image upload remains specialized/browser-assisted",
      },
    };
  }

  buildUrl(operation, input) {
    const url = new URL(`https://${this.domainPrefix}.retail.lightspeed.app${buildPath(operation, input.path_parameters)}`);
    for (const [key, values] of Object.entries(input.query || {})) {
      for (const value of values) url.searchParams.append(key, String(value));
    }
    return url;
  }

  async call(operation, input) {
    if (!this.token) throw new OperationsError("Lightspeed credential is not configured", 503);
    const url = this.buildUrl(operation, input);
    const headers = {
      authorization: `Bearer ${this.token}`,
      accept: "application/json",
      "user-agent": "DiscountFurnitureOperationsAssistant/2026-10-07",
    };
    const init = { method: operation.method, headers };
    if (input.body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(input.body);
    }
    let response;
    try {
      response = await this.fetchImpl(url.toString(), init);
    } catch (error) {
      throw new OperationsError(`Lightspeed request failed before a response was received: ${error?.message || String(error)}`, 502);
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new OperationsError(`Lightspeed response exceeds ${MAX_RESPONSE_BYTES} bytes; use narrower pagination or filters`, 413);
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      throw new OperationsError(`Lightspeed response exceeds ${MAX_RESPONSE_BYTES} bytes; use narrower pagination or filters`, 413);
    }
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    const selectedHeaders = {};
    for (const name of ["content-type", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "etag", "location"]) {
      const value = response.headers.get(name);
      if (value !== null) selectedHeaders[name] = value;
    }
    return {
      ok: response.ok,
      status: response.status,
      headers: selectedHeaders,
      data,
      request: { operation_id: operation.operation_id, method: operation.method, path: `${url.pathname}${url.search}` },
    };
  }

  async getBaseline(operation, input) {
    const baselineInput = baselineInputFor(operation, input);
    if (!baselineInput) {
      return { available: false, hash: null, response: null, note: "No deterministic baseline read is defined for this operation" };
    }
    const response = await this.call(baselineInput.operation, baselineInput);
    return {
      available: true,
      hash: sha256Hex({ status: response.status, data: response.data }),
      response,
      note: response.ok ? null : `Baseline read returned HTTP ${response.status}`,
    };
  }

  async read(raw) {
    const input = normalizeInput(raw, "read");
    return { operation: publicOperation(input.operation), result: await this.call(input.operation, input) };
  }

  makeReceipt(plan) {
    if (!this.signingKey) throw new OperationsError("Local preview signing is not configured", 503);
    const payload = Buffer.from(stableStringify(plan), "utf8").toString("base64url");
    return `${payload}.${hmacBase64Url(this.signingKey, payload)}`;
  }

  readReceipt(receipt, { allowExpired = false } = {}) {
    if (!this.signingKey) throw new OperationsError("Local preview signing is not configured", 503);
    if (typeof receipt !== "string" || receipt.length > 2_000_000) throw new OperationsError("Invalid preview receipt");
    const parts = receipt.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new OperationsError("Invalid preview receipt");
    const [payload, signature] = parts;
    const expected = hmacBase64Url(this.signingKey, payload);
    if (!safeEqual(signature, expected)) throw new OperationsError("Preview receipt signature is invalid");
    let plan;
    try {
      plan = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new OperationsError("Preview receipt payload is invalid");
    }
    if (plan.receipt_version !== RECEIPT_VERSION) throw new OperationsError("Unsupported preview receipt version");
    const expired = !Number.isFinite(plan.expires_at) || this.now() > plan.expires_at;
    if (expired && !allowExpired) throw new OperationsError("Preview receipt expired; create a fresh preview");
    return { plan, expired };
  }

  async preview(raw) {
    const input = normalizeInput(raw, "write");
    const baseline = await this.getBaseline(input.operation, input);
    if (baseline.available && !baseline.response?.ok) {
      throw new OperationsError(`Baseline read failed with HTTP ${baseline.response?.status}; no write preview was created`, 409, baseline);
    }
    const issuedAt = this.now();
    const targetUrl = this.buildUrl(input.operation, input);
    const requestHash = sha256Hex({
      operation_id: input.operation.operation_id,
      path_parameters: input.path_parameters,
      query: input.query,
      body: input.body,
    });
    const plan = {
      receipt_version: RECEIPT_VERSION,
      nonce: this.uuid(),
      issued_at: issuedAt,
      expires_at: issuedAt + RECEIPT_TTL_MS,
      operation_id: input.operation.operation_id,
      path_parameters: input.path_parameters,
      query: input.query,
      body: input.body,
      target_path: `${targetUrl.pathname}${targetUrl.search}`,
      request_hash: requestHash,
      baseline_hash: baseline.hash,
      verification_plan: expectedStatePlan(input.operation, input.body, baseline),
    };
    return {
      ok: true,
      write_executed: false,
      operation: publicOperation(input.operation),
      planned_request: { method: input.operation.method, path: plan.target_path, body: input.body },
      baseline,
      verification_plan: plan.verification_plan,
      preview_receipt: this.makeReceipt(plan),
      preview_hash: requestHash,
      expires_at: new Date(plan.expires_at).toISOString(),
      execution_requirements: [
        "Explicit authorization in the current user task",
        "A fresh unmodified preview receipt",
        "An unchanged baseline when one is available",
        "approved=true, approved_by, and a specific approval_note",
      ],
    };
  }

  async execute(raw) {
    if (!this.writesEnabled) throw new OperationsError("Lightspeed writes are disabled by local configuration", 403);
    if (!this.auditStore) throw new OperationsError("Local audit reservation is not configured; write execution is disabled", 503);
    if (raw?.approved !== true) throw new OperationsError("approved must be true");
    const approvedBy = String(raw.approved_by || "").trim();
    const approvalNote = String(raw.approval_note || "").trim();
    if (approvedBy.length < 2) throw new OperationsError("approved_by is required");
    if (approvalNote.length < 8) throw new OperationsError("approval_note must identify the current authorized task");

    const { plan } = this.readReceipt(raw.preview_receipt);
    const operation = operationFor(plan.operation_id, "write");
    const input = normalizeInput(plan, "write");
    const targetUrl = this.buildUrl(operation, input);
    const expectedTargetPath = `${targetUrl.pathname}${targetUrl.search}`;
    if (plan.target_path !== expectedTargetPath) throw new OperationsError("Preview target no longer matches the operation catalog");
    const expectedRequestHash = sha256Hex({
      operation_id: operation.operation_id,
      path_parameters: input.path_parameters,
      query: input.query,
      body: input.body,
    });
    if (plan.request_hash !== expectedRequestHash) throw new OperationsError("Preview request hash is invalid");

    const currentBaseline = await this.getBaseline(operation, input);
    if (currentBaseline.available && !currentBaseline.response?.ok) {
      throw new OperationsError(`Current baseline read failed with HTTP ${currentBaseline.response?.status}; write was not attempted`, 409, currentBaseline);
    }
    if (plan.baseline_hash !== currentBaseline.hash) {
      throw new OperationsError("Baseline changed after preview; create and review a fresh preview", 409, {
        previous_baseline_hash: plan.baseline_hash,
        current_baseline_hash: currentBaseline.hash,
        current_baseline: currentBaseline,
      });
    }

    const auditId = sha256Hex(plan);
    await this.auditStore.reserve({
      id: auditId,
      created_at: new Date(this.now()).toISOString(),
      operation_id: operation.operation_id,
      method: operation.method,
      target_path: plan.target_path,
      risk: operation.risk,
      request_hash: plan.request_hash,
      baseline_hash: plan.baseline_hash,
      approved_by: approvedBy,
      approval_note: approvalNote,
      status: "executing",
    });

    try {
      const result = await this.call(operation, input);
      const resultHash = sha256Hex({ status: result.status, data: result.data });
      const verification = await this.getBaseline(operation, input);
      const assessment = assessVerification(operation, plan, result, verification);
      await this.auditStore.complete(auditId, {
        status: assessment.status,
        lightspeed_status: result.status,
        result_hash: resultHash,
        verification_strategy: assessment.assertion?.strategy || null,
        verification_supported: assessment.assertion?.supported ?? false,
        verification_passed: assessment.passed,
      });
      return {
        ok: result.ok,
        write_executed: true,
        audit_id: auditId,
        operation: publicOperation(operation),
        result,
        verification,
        verification_assertion: assessment.assertion,
        verification_passed: assessment.passed,
        verification_note: assessment.note,
      };
    } catch (error) {
      try {
        await this.auditStore.complete(auditId, {
          status: "failed_or_unknown",
          lightspeed_status: error?.status || null,
          result_hash: sha256Hex(error?.message || String(error)),
        });
      } catch {
        // Preserve the original request error. The exclusive reservation still prevents replay.
      }
      error.writeExecuted = true;
      error.auditId = auditId;
      throw error;
    }
  }

  async verify(raw) {
    const { plan, expired } = this.readReceipt(raw?.preview_receipt, { allowExpired: true });
    const operation = operationFor(plan.operation_id, "write");
    const input = normalizeInput(plan, "write");
    const current = await this.getBaseline(operation, input);
    const verificationAssertion = expectedStateAssertion(operation, plan, current);
    return {
      ok: true,
      operation: publicOperation(operation),
      preview_expired: expired,
      preview_baseline_hash: plan.baseline_hash,
      current,
      changed_since_preview: plan.baseline_hash !== current.hash,
      verification_assertion: verificationAssertion,
      verification_passed: verificationAssertion.matched,
    };
  }
}
