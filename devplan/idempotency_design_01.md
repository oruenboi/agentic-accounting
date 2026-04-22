---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# Idempotency Design 01

## Purpose
Define how idempotency should work for the accounting backend so that:

- repeated write requests do not duplicate financial mutations
- agent retries are safe
- approval-gated operations remain replay-safe
- API behavior is deterministic for both UI and OpenClaw callers

## Why This Matters
In an accounting platform, duplicate writes are not a minor bug. They can create:
- duplicate journal postings
- duplicate reversals
- duplicate approval resolutions
- inconsistent audit trails

Agent systems make this risk higher because retries, reconnects, wait/resume behavior, and operator replays are common.

## Scope
This design applies to all mutating operations, including:
- create draft
- submit for approval
- commit draft
- reverse posted entry
- reconcile schedule
- approve or reject approval request
- future proposal and workflow mutation endpoints

It also applies to agent tool invocations that trigger backend writes.

## Principles

### 1. Same Intent Must Produce One Logical Effect
If the same actor submits the same write request twice with the same idempotency key, the backend must return the original result and must not apply the mutation again.

### 2. Same Key, Different Payload Must Fail
If the same idempotency key is reused with a different payload for the same actor and action, the backend must reject it as a conflict.

### 3. Idempotency Is Mandatory For Writes
For this platform, write-path idempotency is not optional.

### 4. Idempotency Belongs In The Backend
OpenClaw may have its own run-level dedupe, but the accounting backend must remain authoritative for write replay behavior.

## Data Model

### Table: `idempotency_keys`

Recommended fields:

- `id uuid pk`
- `firm_id uuid not null`
- `organization_id uuid not null`
- `actor_type text not null`
- `actor_id text not null`
- `action text not null`
- `idempotency_key text not null`
- `request_hash text not null`
- `request_body jsonb null`
- `status text not null`
- `response_code integer null`
- `response_body jsonb null`
- `result_entity_type text null`
- `result_entity_id text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `expires_at timestamptz null`

Recommended uniqueness:
- unique on `(actor_type, actor_id, action, idempotency_key)`

### Status Values
- `in_progress`
- `succeeded`
- `failed`

## Request Hashing

### Normalization Requirement
The backend should compute a stable hash from a normalized request payload.

Normalization rules:
- ignore transport-only fields that do not affect the business operation
- preserve all fields that affect accounting outcome
- use deterministic key ordering
- use canonical string forms for decimal values where possible

### Hash Input Should Include
- action name
- actor identity
- tenant identity
- normalized request body

### Why
This prevents accidental key reuse with changed accounting meaning.

## Required Behavior

### Case 1: First Request
If there is no matching idempotency record:
- create an `in_progress` row
- execute the mutation
- store the result
- mark row `succeeded` or `failed`

### Case 2: Replay With Same Key And Same Payload
If there is an existing row with:
- same actor
- same action
- same key
- same request hash

then:
- return the original stored response
- do not re-run the mutation

### Case 3: Same Key With Different Payload
If there is an existing row with:
- same actor
- same action
- same key
- different request hash

then:
- return `IDEMPOTENCY_CONFLICT`
- do not run the mutation

### Case 4: In-Progress Request Collision
If the same key is already marked `in_progress`:
- return a conflict or a deterministic “still processing” response
- do not start a second execution

Recommended error:
- `CONCURRENT_MODIFICATION` or a dedicated `REQUEST_IN_PROGRESS`

## Operations That Must Require Idempotency

### Current V1
- `POST /api/v1/accounts`
- `POST /api/v1/journal-entry-drafts`
- `POST /api/v1/journal-entry-drafts/:id/submit`
- `POST /api/v1/journal-entry-drafts/:id/commit`
- `POST /api/v1/journal-entries/:id/reverse`
- `POST /api/v1/schedules/:id/reconcile`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`
- mutating `/agent-tools/v1/execute` calls
- mutating `/agent-tools/v1/execute-batch` calls

## Actor Scoping

Idempotency keys should not be globally unique across all actors. They should be scoped by:
- `actor_type`
- `actor_id`
- `action`

This avoids collisions between:
- a UI user
- an agent
- a system job

## Tenant Scoping

Idempotency resolution should also preserve tenant boundaries.

Recommended recorded values:
- `firm_id`
- `organization_id`

This ensures replay behavior is auditable and tenant-safe.

## Response Replay

The backend should store enough information to replay the original response.

Recommended:
- HTTP status code
- canonical response body
- result entity reference

For example:
- `journal_entry_id`
- `approval_request_id`
- `schedule_run_id`

## Retention

### Operational Minimum
- 24 to 72 hours minimum for active replay protection

### Recommended For This Platform
- 7 to 30 days for operational investigation and safe retry windows

The row does not need to live forever, but it should live long enough for:
- agent retries
- user refreshes
- delayed approval/commit flows

## Approval Interaction

Idempotency must work correctly across approval-gated operations.

### Example: Commit Draft Requires Approval
Request:
- `commit_journal_entry`
- key `idem_123`

If policy says approval is required:
- create or return the same approval request
- return the same `approval_request_id` for repeated requests with the same key and payload
- do not create duplicate approval requests

### Example: Approval Resolution
Approving the same approval request twice with the same key should:
- return the first resolution result
- not resolve it twice

## Agent Tool Interaction

For OpenClaw-triggered write tools:
- OpenClaw should provide an idempotency key
- backend should remain authoritative for replay semantics
- OpenClaw host dedupe is helpful but not sufficient

### Recommended Mapping
- OpenClaw run ID is not enough by itself
- plugin should send explicit backend `idempotency_key`

## Batch Execution

For `/agent-tools/v1/execute-batch`:
- top-level idempotency key required if the batch mutates state
- each mutating item should also have an item-level stable identifier
- each item should resolve independently unless explicit atomic batch behavior is introduced later

V1 recommendation:
- no cross-item transaction semantics
- ordered independent execution

## Error Codes

Recommended idempotency-related errors:
- `MISSING_IDEMPOTENCY_KEY`
- `IDEMPOTENCY_CONFLICT`
- `DUPLICATE_REQUEST`
- `CONCURRENT_MODIFICATION`

## Auditing

Every mutating request should record the idempotency key into:
- audit logs
- approval records where relevant
- resulting entity metadata where useful

This is important for replay investigation.

## Recommended Implementation Steps

1. Add `idempotency_keys` table
2. Add unique constraint and request-hash handling
3. Wrap mutating application service methods with idempotency acquisition and replay logic
4. Store canonical response payloads
5. Add integration tests for:
   - duplicate same-payload replay
   - same-key different-payload conflict
   - in-progress collision
   - approval-gated replay

## Acceptance Criteria
- All write endpoints reject missing idempotency keys
- Same-key same-payload requests return the original result without duplicate mutation
- Same-key different-payload requests return conflict
- Approval-gated writes do not create duplicate approval requests
- Replay behavior is auditable
