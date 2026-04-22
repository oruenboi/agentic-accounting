---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Schedule Schema Implementation 01

## Purpose
Define the implementation-facing storage model for balance sheet schedules and related tie-out records. This turns the schedule engine design into concrete tables and rollout order.

## Design Principles
- A schedule run is a generated accounting support artifact.
- Schedule rows should preserve reviewability and tie-out evidence.
- Schedule total and GL balance must be stored for reconciliation.
- Schedule runs should be rerunnable and historically preservable.
- Variance is a first-class outcome, not an error-only edge case.

## Core Tables

### `schedule_definitions`
Suggested fields:
- `id`
- `firm_id`
- `organization_id` nullable for template scope
- `schedule_type`
- `name`
- `description`
- `gl_account_ids`
- `generation_strategy`
- `group_by`
- `is_active`
- `created_at`
- `updated_at`

Purpose:
- define how a schedule type maps to ledger accounts and generation logic

### `schedule_runs`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `schedule_definition_id`
- `schedule_type`
- `as_of_date`
- `status`
- `gl_balance`
- `schedule_total`
- `variance`
- `generated_at`
- `generated_by_actor_type`
- `generated_by_actor_id`
- `reviewed_at`
- `reviewed_by_user_id`
- `metadata`

Recommended statuses:
- `generated`
- `variance_detected`
- `reconciled`
- `reviewed`
- `superseded`

### `schedule_run_rows`
Suggested fields:
- `id`
- `schedule_run_id`
- `row_order`
- `reference_type`
- `reference_id`
- `reference_number`
- `counterparty_id`
- `counterparty_name`
- `document_date`
- `due_date`
- `opening_amount`
- `movement_amount`
- `closing_amount`
- `age_bucket`
- `metadata`

Purpose:
- persist the supporting detail behind each schedule run

### `schedule_reconciliations`
Suggested fields:
- `id`
- `schedule_run_id`
- `firm_id`
- `organization_id`
- `gl_balance`
- `schedule_total`
- `variance`
- `status`
- `reviewed_by_user_id`
- `reviewed_at`
- `notes`
- `metadata`

Recommended statuses:
- `unreviewed`
- `reconciled`
- `variance_detected`
- `approved_with_variance`

## Index Strategy
Recommended indexes:
- `(organization_id, schedule_type, as_of_date)`
- `(schedule_definition_id)`
- `(status)`
- `(generated_at)`
- `(reviewed_at)`
- `(schedule_run_id)`

These support:
- schedule lookup
- period review
- close dashboards
- exception queues

## Generation Flow
1. resolve organization, schedule type, and as-of date
2. load active definition
3. compute GL balance from reporting SQL
4. generate rows using configured strategy
5. compute schedule total
6. compute variance
7. persist run, rows, and reconciliation
8. mark reconciled or variance_detected

## First Supported Schedule Types
Recommended first wave:
- `accounts_receivable`
- `accounts_payable`
- `bank`
- `accruals`
- `prepayments`
- `fixed_assets`
- `tax_payable`

The schema should support these even if some strategies are implemented later.

## Relationship To Reporting
Schedule GL balances should come from the canonical reporting layer.

Rules:
- do not recompute account balances independently in the schedule layer
- do not include drafts
- do not treat open approval items as posted balance changes

## Relationship To Close
Schedule runs should be linkable to:
- close checklist runs
- close checklist items
- audit records
- report exports

This supports period-close evidence packs.

## Rerun And Supersession
Schedules should be rerunnable for the same organization/type/date.

Recommended behavior:
- new runs can supersede prior runs
- prior runs should remain queryable
- do not overwrite historical support records in place unless the design explicitly requires it

## Error Model
Suggested error codes:
- `SCHEDULE_NOT_FOUND`
- `SCHEDULE_VARIANCE_DETECTED`
- `SCHEDULE_NOT_RECONCILED`
- `SCHEDULE_DEF_NOT_FOUND`
- `SCHEDULE_GENERATION_FAILED`

## Non-Goals For V1
- bank feed ingestion pipeline
- asset register full lifecycle
- tax filing automation
- schedule-specific custom query builder

## Dependencies
- reporting SQL implementation
- audit model
- workflow/close model
- document model
- background jobs

## Acceptance Criteria
- The schema can persist schedule definitions, runs, rows, and reconciliations.
- GL balance, schedule total, and variance are stored explicitly.
- First-wave schedule types are clearly named and supported by the model.
- The schema is detailed enough to implement without further planning work.
