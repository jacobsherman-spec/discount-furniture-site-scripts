# Write verification contract

The connector's write-verification contract is `expected-state-v1`. An HTTP success, a changed response hash, or a save message is never enough to mark a write verified.

## Preview and drift gate

`lightspeed_preview_change` remains read-only, including when write execution is disabled. For an operation with a deterministic baseline read, preview returns the full nonsecret baseline evidence and derives a signed `verification_plan` from that baseline:

- a resource delete can be checked by reloading the exact target;
- a same-resource `PUT` or `PATCH` is eligible only when its request structure maps directly to fields present in the preview baseline;
- creates, action endpoints, collection-member deletes, and request shapes that do not map directly to the reloaded resource are labeled unsupported.

The plan is included in the signed receipt. Before execution, the connector reloads the baseline and compares its full hash with the preview hash. Any drift blocks the write and requires a new preview.

## Exact requested-state assertion

After a successful request, the connector reloads the deterministic target and applies the signed plan:

- A resource delete passes only when the reload returns HTTP `404` or `410`.
- An eligible `PUT` or `PATCH` passes only when every requested field has the exact requested JSON value.
- Objects compare only the fields the request explicitly supplied, so server-generated identifiers, timestamps, versions, and other response metadata may remain in the saved record.
- Primitive values and `null` use strict JSON equality.
- Arrays require the exact requested length, order, and requested values. Objects inside arrays may contain additional server-generated response fields.
- Lightspeed's standard top-level `data` response envelope is supported when that envelope was established from the preview baseline.

The connector returns `verification_assertion`, `verification_passed`, and a nonsecret note. Mismatch reporting contains JSON paths only; it does not repeat customer, financial, product, or credential values. The local audit receipt records the verification strategy, whether that strategy was supported, and whether it passed.

`lightspeed_verify_change` applies the same signed assertion to the current reload and separately reports `changed_since_preview`. A hash change may be useful diagnostic evidence, but it cannot make an assertion pass. Conversely, an idempotent update can pass when the exact requested state is present even if the full resource hash did not change.

## Conservative inconclusive results

The connector returns `verification_required` rather than guessing when exact proof is unavailable. This includes:

- create operations without a deterministic resource URL;
- action endpoints whose request body does not describe the resource returned by the baseline operation;
- bulk or collection-member changes that require identity-aware reconciliation;
- legacy or nested request models that do not map directly to the reload shape;
- server normalization that changes a requested representation;
- a missing or failed reload.

For an inconclusive result, keep the workflow item open and perform the domain's targeted proof: an exact supported read, a fresh filtered export, complete saved-gallery reconciliation, a public-storefront check, or another source-specific audit. Never retry a write merely because verification was inconclusive.

## Test boundary

The mock regression suite covers exact matches, response envelopes, idempotent updates, timestamp-only false positives, array shape, unsupported action operations, standalone verification, drift, replay, delete absence, and collection-member delete boundaries. Setup still performs no live business-record mutation; production write proof remains specific to the first user-authorized operation and its independent workflow evidence.
