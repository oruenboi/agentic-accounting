---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Background Jobs 01

## Purpose
Define the v1 background job architecture for asynchronous processing, retries, locking, failure recovery, and job classes used by reporting, schedules, workflows, and future agent-assisted operations.

## Design Principles
- Background jobs are for async orchestration, not for bypassing accounting controls.
- Every job must be replay-safe or explicitly non-retriable.
- Jobs that can change business state must be idempotent.
- Long-running or bulk operations should not block API requests.
- Failures must be observable and recoverable without silent data loss.
- Async execution should never weaken tenant isolation or auditability.

## V1 Objectives
- support asynchronous schedule generation
- support asynchronous report export generation
- support close-precheck and checklist preparation
- support future bank import normalization and reconciliation suggestion jobs
- support future agent-originated long-running tasks without tying them to a single request lifecycle

## Job Categories

### Read-derived jobs
These jobs derive artifacts from canonical data but do not change accounting truth.

Examples:
- generate balance sheet PDF export
- generate trial balance export
- build schedule run from current ledger state
- compile period evidence package

Risk profile:
- lower than mutating jobs
- still require tenant scoping and audit events

### Workflow jobs
These jobs create or update workflow objects.

Examples:
- create close checklist items
- escalate overdue tasks
- generate exception records from failed validations
- sync status summaries

Risk profile:
- medium
- must be idempotent and audit-linked

### Mutating control jobs
These jobs may update controlled, non-ledger business state, but should not post accounting entries unless explicitly designed for it.

Examples:
- mark report run complete
- mark schedule run superseded
- update close run status after checks pass

Risk profile:
- higher than read-derived jobs
- requires stronger idempotency and authorization boundaries

### Deferred future jobs
Examples:
- bank feed import and normalization
- OCR/document extraction
- recurring close reminders
- automated agent review preparation

These should fit the same architecture later.

## What Should Not Be Async In V1
- posting journal entries
- reversing journal entries
- approval decisions
- period close finalization if it depends on immediate user confirmation

These should stay synchronous until the control model is stronger.

## Execution Model
Recommended v1 model:
- NestJS application enqueues job records
- one or more worker processes claim and execute jobs
- job metadata lives in Postgres
- queue broker can also be Postgres-backed at first

Reason:
- avoids introducing Redis too early
- keeps queue state inspectable with existing infrastructure
- matches the current storage and control posture

Redis-backed queues can be added later if load requires them.

## Job Table Model

### `background_jobs`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `job_type`
- `status`
- `priority`
- `payload`
- `result`
- `error_code`
- `error_message`
- `attempt_count`
- `max_attempts`
- `available_at`
- `started_at`
- `completed_at`
- `failed_at`
- `locked_by`
- `locked_at`
- `idempotency_key`
- `request_id`
- `correlation_id`
- `created_by_actor_type`
- `created_by_actor_id`
- `related_entity_type`
- `related_entity_id`
- `created_at`

Recommended statuses:
- `queued`
- `running`
- `succeeded`
- `failed`
- `retry_scheduled`
- `cancelled`

Recommended priorities:
- `low`
- `normal`
- `high`
- `critical`

## Queue Claiming Model
Workers should claim jobs atomically by:
- selecting `queued` or `retry_scheduled` jobs whose `available_at <= now()`
- locking one job
- updating status to `running`
- setting `locked_by` and `locked_at`

This prevents multiple workers from processing the same job simultaneously.

## Idempotency Rules
Every job that can affect business state should carry an `idempotency_key`.

Job idempotency should protect against:
- duplicate enqueueing
- worker crash during execution
- retry after transient failure

Recommended rule:
- same `job_type` + same actor/request + same normalized payload should map to the same logical job or same safe outcome

This is especially important for:
- schedule generation
- report export creation
- close checklist creation

## Retry Strategy

### Retriable failures
Examples:
- temporary database contention
- transient storage upload failure
- temporary dependency outage

Recommended behavior:
- increment `attempt_count`
- set `available_at` with backoff
- move to `retry_scheduled`

### Non-retriable failures
Examples:
- invalid payload
- missing tenant access
- unsupported job type
- failed invariant that requires human intervention

Recommended behavior:
- mark `failed`
- persist `error_code` and `error_message`
- optionally create exception/task

### Backoff
V1 recommendation:
- exponential or stepped backoff
- capped max attempts

Example:
- attempts 1 to 3 use short backoff
- attempts 4+ use longer backoff
- final failure creates operational follow-up

## Locking and Concurrency
Jobs that operate on the same entity or period may need serialization.

Examples:
- do not run two schedule-generation jobs for the same org, schedule type, and as-of date at once
- do not run two close-checklist-generation jobs for the same period at once

V1 recommendation:
- use a deterministic lock key derived from business scope
- enforce uniqueness in enqueue logic where practical
- use row-level claim locking for execution

Potential lock keys:
- `schedule:{organization_id}:{schedule_type}:{as_of_date}`
- `close:{organization_id}:{accounting_period_id}`
- `report:{organization_id}:{report_type}:{as_of_date}`

## Audit Requirements
Every job lifecycle should be auditable.

Recommended audit events:
- `job.queued`
- `job.started`
- `job.succeeded`
- `job.failed`
- `job.cancelled`

Important metadata:
- job type
- actor
- request/correlation IDs
- related entity
- error code on failure

## Workflow Integration
Jobs should integrate cleanly with tasks and exceptions.

Examples:
- failed schedule generation job -> exception + task
- successful close-precheck job -> checklist items created
- failed report export job -> retry or task depending on error type

Jobs do not replace workflow tables. They only execute work and emit results.

## Agent Integration
Agents may trigger jobs indirectly through APIs or tools.

Recommended pattern:
- agent requests action
- backend validates request
- backend creates job if the action is long-running
- API returns job reference
- agent polls or reads job result later

This is appropriate for:
- large evidence pack generation
- multi-report export jobs
- schedule generation across several accounts

Agents should not directly manage worker state.

## Job Result Model
For successful jobs, store a compact `result`.

Examples:
- created `schedule_run_id`
- created `report_run_id`
- created `close_checklist_run_id`
- output attachment reference

Avoid storing huge artifacts in the job table itself. Put large outputs in storage and reference them.

## Failure Recovery
The system should support:
- retrying failed retriable jobs
- inspecting terminal failures
- manually requeueing selected failed jobs
- creating exceptions/tasks for jobs that need human attention

Stuck-job handling:
- if a worker crashes, jobs left in `running` beyond a timeout should be eligible for recovery or investigation

## Suggested API Shape

Internal API candidates:
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/:jobId`
- `GET /api/v1/jobs?organization_id=...`
- `POST /api/v1/jobs/:jobId/retry`
- `POST /api/v1/jobs/:jobId/cancel`

Not every job type needs public creation. Some are system-generated only.

### Agent tool usage
Agents should usually see job-backed actions through domain tools rather than generic job tools.

Examples:
- `generate_balance_sheet_schedule` returns either immediate result or `job_id`
- `generate_period_evidence_pack` likely returns `job_id`

## Suggested Initial Job Types
- `schedule.generate`
- `report.export`
- `close.precheck`
- `close.checklist.generate`
- `evidence_pack.generate`

Deferred:
- `bank.import.normalize`
- `bank.match.suggest`
- `document.extract`

## Non-Goals For V1
- full distributed workflow engine
- Kafka/event-stream architecture
- Redis dependency
- arbitrary user-defined recurring jobs

## Dependencies
- idempotency design
- workflow and close model
- storage blueprint
- document model
- audit model

## Implementation Sequence
1. Add `background_jobs` table
2. Add enqueue and claim service
3. Add worker process with retry handling
4. Implement `schedule.generate`
5. Implement `report.export`
6. Add exception/task integration for failures
7. Add monitoring and stuck-job recovery

## Acceptance Criteria
- Long-running report and schedule work can run outside the request lifecycle.
- Job execution is tenant-scoped, auditable, and replay-safe.
- Retries distinguish transient from terminal failure.
- Concurrent workers do not process the same logical job twice.
- Failed jobs can surface follow-up workflow items instead of disappearing silently.
