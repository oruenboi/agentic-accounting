---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# Reporting Design 01

## Purpose
Define the canonical v1 reporting model for the accounting platform, including report types, query inputs, SQL object strategy, reconciliation expectations, and the contract between the ledger and reporting layers.

## Design Principles
- Posted ledger data is the only source of truth for financial reporting.
- Reports are read-only outputs and must never contain write-path logic.
- Report logic should be centralized in SQL views and functions, not duplicated across UI handlers, agent tools, and exports.
- Only `posted` journal entries count toward financial statements.
- Reversals must be reflected through their posted ledger effect; reports should not special-case them in application code.
- Balance sheet reports are point-in-time reports.
- Profit and loss reports are period-activity reports.
- Trial balance and general ledger outputs must support drill-down back to journal entries and lines.

## V1 Report Set

### Trial Balance
Purpose:
- Show ending balances by account as of a date.

Required inputs:
- `organization_id`
- `as_of_date`

Optional inputs:
- `account_ids`
- `include_zero_balances`
- `detail_level`

Output requirements:
- account code
- account name
- account type
- debit balance
- credit balance
- net signed balance
- report totals

### Balance Sheet
Purpose:
- Show assets, liabilities, and equity as of a date.

Required inputs:
- `organization_id`
- `as_of_date`

Optional inputs:
- `account_ids`
- `section_filter`
- `detail_level`

Output requirements:
- sections by balance sheet grouping
- line items by account or grouped account category
- section totals
- overall totals
- proof that assets equal liabilities plus equity

### Profit and Loss
Purpose:
- Show income and expenses across a period.

Required inputs:
- `organization_id`
- `from_date`
- `to_date`

Optional inputs:
- `account_ids`
- `detail_level`

Output requirements:
- revenue section
- expense section
- net income
- optional grouped subtotals

### General Ledger
Purpose:
- Show entry-by-entry activity and running balance for selected accounts over a period.

Required inputs:
- `organization_id`
- `from_date`
- `to_date`

Optional inputs:
- `account_ids`
- `entry_ids`
- `source_type`
- `detail_level`

Output requirements:
- account header
- opening balance
- dated ledger lines
- source references
- running balance
- closing balance

## Canonical Reporting Inputs
All report queries should normalize to these fields where applicable:

- `organization_id`
- `as_of_date`
- `from_date`
- `to_date`
- `basis`
- `account_ids`
- `detail_level`
- `include_zero_balances`

V1 basis support:
- `accrual` only

Cash-basis reporting can be added later, but it should not distort the v1 ledger or SQL model.

## Ledger Read Rules
Reporting must only use:
- `journal_entries.status = 'posted'`
- `journal_entry_lines`
- valid account metadata from `accounts`
- period metadata when needed for filtering and validation

Reporting must not depend on:
- drafts
- approval queues
- task tables
- agent proposals

Those objects can inform workflows, but they are not financial truth.

## SQL Object Strategy

### Raw tables
Use raw tables for:
- `accounts`
- `journal_entries`
- `journal_entry_lines`
- `accounting_periods`

### Canonical views
Create stable SQL views for reusable financial logic:
- `v_posted_journal_lines`
- `v_trial_balance`
- `v_balance_sheet`
- `v_profit_and_loss`
- `v_general_ledger_lines`

The application and agent APIs should query these views or call SQL functions built on top of them.

### Optional materialized views
Do not create materialized views in v1 unless performance data justifies them.

Likely future candidates:
- `mv_account_daily_balances`
- `mv_account_monthly_balances`
- `mv_org_report_status`

## Suggested Canonical View Responsibilities

### `v_posted_journal_lines`
Responsibility:
- Flatten posted journal entry and line data into a single reporting-friendly relation.

Required columns:
- `firm_id`
- `organization_id`
- `journal_entry_id`
- `journal_entry_line_id`
- `entry_number`
- `entry_date`
- `source_type`
- `source_id`
- `memo`
- `account_id`
- `account_code`
- `account_name`
- `account_type`
- `account_subtype`
- `debit`
- `credit`
- `signed_amount`

Signed amount convention:
- assets and expenses: `debit - credit`
- liabilities, equity, and revenue: `credit - debit`

### `v_trial_balance`
Responsibility:
- Aggregate ending balances by account as of a date-ready shape.

Recommended columns:
- `organization_id`
- `account_id`
- `account_code`
- `account_name`
- `account_type`
- `net_balance`
- `debit_balance`
- `credit_balance`

### `v_balance_sheet`
Responsibility:
- Provide balance sheet-ready rows grouped into sections.

Recommended columns:
- `organization_id`
- `as_of_date`
- `section`
- `display_order`
- `account_id`
- `account_code`
- `account_name`
- `amount`

### `v_profit_and_loss`
Responsibility:
- Provide P&L-ready period movement rows.

Recommended columns:
- `organization_id`
- `from_date`
- `to_date`
- `section`
- `display_order`
- `account_id`
- `account_code`
- `account_name`
- `amount`

### `v_general_ledger_lines`
Responsibility:
- Provide line-level account movement suitable for running-balance generation.

Recommended columns:
- `organization_id`
- `account_id`
- `entry_date`
- `journal_entry_id`
- `journal_entry_line_id`
- `entry_number`
- `memo`
- `source_type`
- `source_id`
- `debit`
- `credit`
- `signed_amount`

## SQL Function Strategy
Prefer parameterized SQL functions on top of canonical views for API-facing retrieval:

- `fn_trial_balance(p_organization_id uuid, p_as_of_date date, p_include_zero_balances boolean default false)`
- `fn_balance_sheet(p_organization_id uuid, p_as_of_date date)`
- `fn_profit_and_loss(p_organization_id uuid, p_from_date date, p_to_date date)`
- `fn_general_ledger(p_organization_id uuid, p_from_date date, p_to_date date, p_account_ids uuid[] default null)`

Reasons:
- cleaner API integration
- easier RLS-aware execution
- easier backward-compatible evolution

## Account Classification Rules
Reporting depends on consistent account metadata.

Minimum account fields required for report mapping:
- `type`
- `subtype`
- `is_active`
- `display_order`

V1 section mapping:
- `asset` -> balance sheet assets
- `liability` -> balance sheet liabilities
- `equity` -> balance sheet equity
- `revenue` -> profit and loss revenue
- `expense` -> profit and loss expenses

Section mapping should live in the database or shared domain layer, not duplicated ad hoc in the UI.

## Reconciliation Expectations

### Trial Balance
Must prove:
- total debits = total credits

### Balance Sheet
Must prove:
- assets = liabilities + equity

### Profit and Loss
Must reconcile:
- net income into equity movement conceptually, even if the equity roll-forward is not a v1 report

### General Ledger
Must reconcile:
- opening balance + period movement = closing balance

If report totals do not reconcile, the result should be treated as an implementation defect or a data integrity issue.

## API Contract Expectations
Reporting APIs and agent tools should return:
- query parameters used
- report currency
- report timestamp
- rows
- totals
- lineage metadata when requested

Agent-friendly reporting responses should also include:
- `human_summary`
- `machine_summary`

## Exports and Snapshots
V1 reporting should support two modes:

### Live mode
- calculated from current posted ledger state

### Snapshot mode
- tied to a report run or close process later

Snapshot persistence is not mandatory for every ad hoc report in v1, but the model should not block it.

## Non-Goals for V1
- cash-basis reporting
- consolidated multi-organization financial statements
- budget vs actual
- segment reporting beyond optional future dimensions
- complex custom report builders

## Dependencies
- complete ledger schema
- reliable account classification fields
- closed-period enforcement in write paths
- tenant and RLS correctness

## Implementation Sequence
1. Add `v_posted_journal_lines`
2. Add `fn_trial_balance`
3. Add `fn_balance_sheet`
4. Add `fn_profit_and_loss`
5. Add `fn_general_ledger`
6. Add API handlers and agent tool bindings
7. Add report correctness tests

## Acceptance Criteria
- Trial balance totals reconcile on posted data only.
- Balance sheet proves `assets = liabilities + equity`.
- P&L returns revenue, expenses, and net income for any valid date range.
- General ledger supports account-scoped drill-down with running balances.
- API and agent tool responses derive from a single canonical SQL/reporting layer.
