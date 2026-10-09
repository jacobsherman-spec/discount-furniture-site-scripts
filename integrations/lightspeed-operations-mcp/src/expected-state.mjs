const IDENTIFIER_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const ENVELOPE_KEYS = new Set(["data", "links", "meta"]);
const MAX_MISMATCH_PATHS = 25;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function childPath(path, key) {
  return IDENTIFIER_KEY.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function addMismatch(mismatches, path) {
  if (mismatches.length < MAX_MISMATCH_PATHS) mismatches.push(path);
}

function compareNode(expected, actual, path, mismatches) {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(expected, actual)) addMismatch(mismatches, path);
    return;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      addMismatch(mismatches, path);
      return;
    }
    if (actual.length !== expected.length) addMismatch(mismatches, `${path}.length`);
    const sharedLength = Math.min(expected.length, actual.length);
    for (let index = 0; index < sharedLength; index += 1) {
      compareNode(expected[index], actual[index], `${path}[${index}]`, mismatches);
    }
    return;
  }

  if (!isPlainObject(expected) || !isPlainObject(actual)) {
    addMismatch(mismatches, path);
    return;
  }

  if (Object.keys(expected).length === 0) {
    if (Object.keys(actual).length !== 0) addMismatch(mismatches, path);
    return;
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const pathForKey = childPath(path, key);
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      addMismatch(mismatches, pathForKey);
      continue;
    }
    compareNode(expectedValue, actual[key], pathForKey, mismatches);
  }
}

function isEnvelope(value, expected) {
  if (!isPlainObject(value) || !Object.prototype.hasOwnProperty.call(value, "data")) return false;
  if (isPlainObject(expected) && Object.prototype.hasOwnProperty.call(expected, "data")) return false;
  return Object.keys(value).every((key) => ENVELOPE_KEYS.has(key));
}

function candidateRoots(responseData, expected) {
  const candidates = [{ path: "$", value: responseData }];
  if (isEnvelope(responseData, expected)) candidates.push({ path: "$.data", value: responseData.data });
  return candidates;
}

function rootValue(responseData, path) {
  if (path === "$") return { found: true, value: responseData };
  if (path === "$.data" && isPlainObject(responseData)
      && Object.prototype.hasOwnProperty.call(responseData, "data")) {
    return { found: true, value: responseData.data };
  }
  return { found: false, value: undefined };
}

function hasRequestedState(expected) {
  if (expected === null || typeof expected !== "object") return false;
  if (Array.isArray(expected)) return true;
  return isPlainObject(expected) && Object.keys(expected).length > 0;
}

function hasComparableShape(expected, actual) {
  if (expected === null || typeof expected !== "object") return true;
  if (Array.isArray(expected)) return Array.isArray(actual);
  if (!isPlainObject(expected) || !isPlainObject(actual)) return false;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) return false;
    if (!hasComparableShape(expectedValue, actual[key])) return false;
  }
  return true;
}

export function buildRequestedStatePlan(expected, baselineData) {
  if (!hasRequestedState(expected)) {
    return {
      strategy: "unsupported",
      supported: false,
      checked_root: null,
      reason: "The request body does not contain a comparable requested state",
    };
  }

  for (const candidate of candidateRoots(baselineData, expected)) {
    if (hasComparableShape(expected, candidate.value)) {
      return {
        strategy: "requested_fields_exact_match",
        supported: true,
        checked_root: candidate.path,
        reason: "The request body maps directly to fields in the preview baseline",
      };
    }
  }
  return {
    strategy: "unsupported",
    supported: false,
    checked_root: null,
    reason: "The request body cannot be mapped directly to the preview baseline resource",
  };
}

export function compareRequestedState(expected, responseData, plan = null) {
  if (!hasRequestedState(expected)) {
    return {
      strategy: "unsupported",
      supported: false,
      matched: false,
      checked_root: null,
      mismatch_paths: [],
      reason: "The request body does not contain a comparable requested state",
    };
  }

  if (plan && !plan.supported) {
    return {
      ...plan,
      matched: false,
      mismatch_paths: [],
    };
  }

  let candidates;
  if (plan?.checked_root) {
    const selected = rootValue(responseData, plan.checked_root);
    if (!selected.found) {
      return {
        strategy: "requested_fields_exact_match",
        supported: true,
        matched: false,
        checked_root: plan.checked_root,
        mismatch_paths: [plan.checked_root],
        reason: "The response root selected from the preview baseline is missing after the write",
      };
    }
    candidates = [{ path: plan.checked_root, value: selected.value }];
  } else {
    candidates = candidateRoots(responseData, expected);
  }

  let best = null;
  for (const candidate of candidates) {
    const mismatches = [];
    compareNode(expected, candidate.value, candidate.path, mismatches);
    const result = {
      strategy: "requested_fields_exact_match",
      supported: true,
      matched: mismatches.length === 0,
      checked_root: candidate.path,
      mismatch_paths: mismatches,
      reason: mismatches.length === 0
        ? "Every requested field and value is present in the reloaded state"
        : "The reloaded state does not exactly match every requested field and value",
    };
    if (result.matched) return result;
    if (!best || result.mismatch_paths.length <= best.mismatch_paths.length) best = result;
  }
  return best;
}
