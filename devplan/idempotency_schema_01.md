---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Idempotency Schema 01

## Purpose
Define the implementation-facing schema for replay-safe mutating operations across the accounting platform.

## Design Principles
- Every write path that can be retried should have a stable idempotency record.
- The idempotency layer should prevent duplicate accounting effects, not just duplicate HTTP requests.
- Same key plus same normalized payload should replay safely.
- Same key plus different payload should conflict.
- The key should be scoped to the actor and tenant context where appropriate.

## Core Table

### `idempotency_keys`
Suggested columns:
- `id uuid primary key default gen_random_uuid()`
- `firm_id uuid not null`
- `organization_id uuid not null`
- `actor_type text not null`
- `actor_id text not null`
- `request_id text not null`
- `idempotency_key text not null`
- `operation_name text not null`
- `request_hash text not null`
- `normalized_payload jsonb not null default '{}'::jsonb`
- `status text not null`
- `resource_type text null`
- `resource_id uuid null`
- `response_code int null`
- `response_body jsonb null`
- `error_code text null`
- `error_message text null`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz null`
- `last_seen_at timestamptz not null default now()`

## Status Values
Recommended values:
- `pending`
- `succeeded`
- `failed`
- `conflicted`

Rules:
- `pending` means the request has started but has not yet produced a final persisted outcome.
- `succeeded` means the write completed and the response can be replayed.
- `failed` means the operation ended in a terminal failure and should not be silently replayed as success.
- `conflicted` means the key was reused with a different normalized payload or incompatible request shape.

## Index Strategy
Recommended indexes:
- unique `(firm_id, organization_id, actor_type, actor_id, idempotency_key, operation_name)`
- `(request_id)`
- `(organization_id, created_at desc)`
- `(operation_name, created_at desc)`
- `(expires_at)`

Rationale:
- enforce deduplication within the actor/tenant scope
- support request lookup and replay
- support cleanup of expired keys

## Request Hashing Rules
The `request_hash` should represent the normalized semantic payload, not just the raw body.

Normalization should account for:
- stable key ordering
- stripped whitespace where appropriate
- canonicalized numeric and date formats
- excluded transient metadata such as timestamps that are not part of the business intent

This prevents harmless transport differences from causing false conflicts.

## Replay Behavior
When the same key is reused with the same operation and normalized payload:
- return the original `response_code` and `response_body` if available
- or return the persisted terminal status if the initial request is still completing

When the same key is reused with a different payload:
- return a conflict response
- do not attempt to merge semantics

## Write-Path Usage
Application services should use the idempotency layer around:
- journal draft creation
- journal commit
- reversal
- approval submit/approve/reject actions
- schedule generation
- report export creation
- agent proposal submission
- any future operational workflow that can be retried

Recommended pattern:
1. receive request
2. validate auth and tenant context
3. check idempotency record
4. if replay, return stored result
5. otherwise create pending record
6. execute business logic
7. store terminal outcome and response payload

## Retention
Recommended retention window:
- at least long enough to cover operational retry windows and agent reruns
- short to medium term is sufficient, because this is not a permanent accounting record

Suggested default:
- 7 to 30 days minimum
- longer only if operationally necessary

## Conflict Handling
Conflict scenarios include:
- same key, different payload
- same key, different operation name
- same key, wrong tenant or actor scope

These should be explicit errors, not silent replays.

## Audit Relationship
Idempotency records should not replace audit logs.

They should be linked to audit events so a reviewer can trace:
- who retried what
- whether the retry was safe
- which final resource was produced

## Dependencies
- API auth/client model
- application logic layering
- audit model
- approval behavior

## Acceptance Criteria
- The schema supports safe replay of mutating requests.
- Conflicts are distinguishable from successful replays.
- Application services have a clear place to store request hashes and terminal responses.
- The schema is ready to back both user and agent write paths.
