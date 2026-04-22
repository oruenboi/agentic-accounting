---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# Schedule Engine 01

## Purpose
Define the v1 balance sheet schedule model, generation flow, reconciliation rules, and the link between schedules, the general ledger, and period-close review.

## Design Principles
- A balance sheet schedule is supporting evidence for a balance sheet line.
- Schedule totals must reconcile to mapped GL balances.
- Schedules are generated objects with review state, not ad hoc spreadsheet artifacts.
- Schedule rows may come from subledger-like data or from classified ledger support rows, but the tie-out always goes back to the GL.
- A schedule with a non-zero variance is an exception until resolved or explicitly approved.

## V1 Schedule Set
- `bank`
- `accounts_receivable`
- `accounts_payable`
- `accruals`
- `prepayments`
- `fixed_assets`
- `tax_payable`

This is the minimum useful month-end set for an accounting firm workflow.

## Core Concepts

### Schedule Definition
Defines:
- which GL accounts the schedule supports
- how rows are grouped
- which generation strategy is used

### Schedule Run
An actual schedule generated for a specific organization, schedule type, and as-of date.

### Schedule Row
A row inside a generated schedule run representing the supporting item or grouped support line.

### Schedule Reconciliation
The tie-out object comparing schedule total to GL balance, including variance, reviewer status, and notes.

## Data Model

### `schedule_definitions`
Suggested fields:
- `id`
- `firm_id`
- `organization_id` nullable for firm templates
- `schedule_type`
- `name`
- `description`
- `gl_account_ids`
- `generation_strategy`
- `group_by`
- `is_active`
- `created_at`

Purpose:
- map one schedule type to one or more accounts
- allow firm-default templates with organization overrides later

### `schedule_runs`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `schedule_definition_id`
- `schedule_type`
- `as_of_date`
- `status`
- `generated_at`
- `generated_by_actor_type`
- `generated_by_actor_id`
- `gl_balance`
- `schedule_total`
- `variance`

Status candidates:
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

Not every schedule needs every column. Keep generic columns plus a JSONB `metadata` field for schedule-specific detail.

### `schedule_reconciliations`
Suggested fields:
- `id`
- `schedule_run_id`
- `organization_id`
- `gl_balance`
- `schedule_total`
- `variance`
- `status`
- `reviewed_by_user_id`
- `reviewed_at`
- `notes`

Status candidates:
- `unreviewed`
- `reconciled`
- `variance_detected`
- `approved_with_variance`

## Generation Strategies
V1 should support these strategies:

### Subledger-derived
For:
- AR
- AP

Rows come from operational documents or future subledger tables. Until those exist, schedule generation may use tagged ledger support or stub support tables.

### Ledger-derived
For:
- accruals
- prepayments
- tax payable

Rows come from ledger lines or supporting tagged references that can be grouped into meaningful supporting items.

### Register-derived
For:
- fixed assets

Rows come from an asset register and depreciation schedule later. V1 can define the contract before implementing the asset register itself.

### Hybrid bank strategy
For:
- bank

Rows combine book balances and reconciling items. V1 can start with book-side support and later integrate bank transactions.

## Generation Flow
1. Resolve `organization_id`, `schedule_type`, and `as_of_date`.
2. Load active `schedule_definition`.
3. Resolve mapped GL accounts.
4. Compute GL balance from the canonical reporting layer.
5. Generate schedule rows using the strategy for that schedule type.
6. Sum schedule row closing values into `schedule_total`.
7. Compute `variance = gl_balance - schedule_total`.
8. Insert `schedule_run`.
9. Insert `schedule_run_rows`.
10. Insert `schedule_reconciliation`.
11. Mark status:
   - `reconciled` if variance is zero
   - `variance_detected` if variance is non-zero

The generation flow should be rerunnable. New runs should supersede older runs rather than mutating them in place.

## Reconciliation Rules
- Zero variance means the schedule ties to GL.
- Non-zero variance creates an exception state.
- Approval may be required to mark a non-zero variance as accepted.
- Review metadata must record who reviewed the schedule and when.
- Schedule review should never alter GL balances directly.

## Schedule Output Contract
Each schedule response should include:
- `schedule_run_id`
- `schedule_type`
- `as_of_date`
- `gl_accounts`
- `gl_balance`
- `schedule_total`
- `variance`
- `reconciled`
- `rows`
- `exceptions`

Optional agent-friendly additions:
- `human_summary`
- `machine_summary`

## Mapping to Balance Sheet Lines
Each schedule type should map to one or more balance sheet accounts.

Examples:
- `accounts_receivable` -> receivable accounts
- `accounts_payable` -> payable accounts
- `bank` -> bank and cash accounts
- `accruals` -> accrued liability accounts
- `prepayments` -> prepaid asset accounts
- `fixed_assets` -> asset cost and accumulated depreciation pairs
- `tax_payable` -> tax payable / receivable accounts

The balance sheet API should be able to indicate when a line has a supporting schedule and how to retrieve it.

## Interaction with Reporting
Schedules depend on the reporting layer for GL balances.

Required integration points:
- canonical GL balance lookup by account group and as-of date
- lineage back to journal entries when variance explanation is requested
- shared account classification rules

Do not compute a separate interpretation of balances inside the schedule engine.

## Workflow Integration
Schedules should plug into:
- close checklists
- review queues
- exception handling
- agent proposal flows

Typical lifecycle:
1. generated
2. reconciled or variance_detected
3. reviewed
4. optionally linked to close signoff

## Agent Use
Agents should be allowed to:
- generate schedules
- read schedules
- attempt reconciliation
- explain variance

Agents should not automatically:
- approve schedules with non-zero variance
- mark close-critical schedules reviewed without policy approval

Suggested agent tools:
- `get_balance_sheet_schedule`
- `generate_balance_sheet_schedule`
- `reconcile_balance_sheet_schedule`
- `explain_schedule_variance`
- `list_unreconciled_schedule_accounts`

## Exception Handling
When `variance != 0`:
- create a schedule exception or task later
- keep the schedule status as `variance_detected`
- allow linked journal proposal generation in a future step

Examples:
- missing AR support rows
- manual accrual posted without support metadata
- prepayment amortization schedule not updated
- bank reconciling item missing

## Snapshot and Review Expectations
Month-end and year-end schedules should be preservable as evidence.

Required review metadata:
- preparer identity
- generation timestamp
- reviewer identity
- review timestamp
- notes

This supports close packs and audit support later.

## Non-Goals for V1
- full bank feed reconciliation engine
- full asset register implementation
- automated tax filing schedules
- consolidated group schedules across organizations

## Dependencies
- reporting SQL layer
- tenant/RLS correctness
- approval workflow
- task/exception workflow

## Implementation Sequence
1. Add `schedule_definitions`
2. Add `schedule_runs`
3. Add `schedule_run_rows`
4. Add `schedule_reconciliations`
5. Build GL balance lookup function reuse from reporting SQL
6. Implement first schedule types:
   - `accounts_receivable`
   - `accounts_payable`
   - `bank`
7. Add API and agent tool bindings
8. Add review and exception integration

## Acceptance Criteria
- A schedule run can be generated for a supported `schedule_type` and `as_of_date`.
- The schedule persists run metadata, rows, and reconciliation outcome.
- The system computes `gl_balance`, `schedule_total`, and `variance` consistently.
- Zero-variance schedules can be marked reconciled.
- Non-zero variance is preserved as a reviewable exception state.
- Schedule APIs and agent tools reuse the same canonical generation and reconciliation logic.
