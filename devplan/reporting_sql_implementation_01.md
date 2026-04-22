---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Reporting SQL Implementation 01

## Purpose
Define the implementation-facing SQL layer for canonical accounting reporting. This document covers the views and functions that should back trial balance, balance sheet, profit and loss, and general ledger outputs.

## Design Principles
- Reports must derive only from posted ledger data.
- The SQL layer should be canonical and reusable across UI, API, and agent tools.
- Summary and drill-down views should share the same underlying ledger source.
- The first implementation should favor correctness and clarity over aggressive precomputation.

## Canonical Source Tables
Reporting should be built from:
- `accounts`
- `journal_entries`
- `journal_entry_lines`
- `accounting_periods`

Only posted entries should be included.

## Proposed SQL Objects

### `v_posted_journal_lines`
Purpose:
- flattened posted lines for all report calculations

Essential columns:
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

### `v_trial_balance`
Purpose:
- account balances as of a date

Essential columns:
- `organization_id`
- `account_id`
- `account_code`
- `account_name`
- `account_type`
- `debit_balance`
- `credit_balance`
- `net_balance`

### `v_balance_sheet`
Purpose:
- balance sheet-ready rows grouped into sections

Essential columns:
- `organization_id`
- `as_of_date`
- `section`
- `display_order`
- `account_id`
- `account_code`
- `account_name`
- `amount`

### `v_profit_and_loss`
Purpose:
- period movement rows for revenue and expense accounts

Essential columns:
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
Purpose:
- detailed ledger drill-down with running balance support

Essential columns:
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

## Suggested SQL Functions
The API layer can consume parameterized functions built on the canonical views:
- `fn_trial_balance(p_organization_id uuid, p_as_of_date date, p_include_zero_balances boolean default false)`
- `fn_balance_sheet(p_organization_id uuid, p_as_of_date date)`
- `fn_profit_and_loss(p_organization_id uuid, p_from_date date, p_to_date date)`
- `fn_general_ledger(p_organization_id uuid, p_from_date date, p_to_date date, p_account_ids uuid[] default null)`

Function advantages:
- clear API boundary
- easier permission enforcement
- predictable backward compatibility

## Output Rules

### Trial balance
- must reconcile debits and credits
- must be account-scoped

### Balance sheet
- must support assets, liabilities, and equity sections
- must prove `assets = liabilities + equity`

### Profit and loss
- must show revenue, expense, and net income
- must use period movement, not point-in-time balances

### General ledger
- must show source references
- must support running balances and drill-down

## Rollout Order
Implement in this sequence:
1. `v_posted_journal_lines`
2. `fn_trial_balance`
3. `fn_balance_sheet`
4. `fn_profit_and_loss`
5. `fn_general_ledger`
6. API integration
7. agent tool bindings

## Index and Performance Notes
- posted lines should be indexed by organization, date, and account
- report functions should avoid scanning drafts
- materialized views are optional later, not a v1 requirement

## Dependencies
- ledger schema
- ledger posting engine
- tenant/RLS model
- reporting design

## Acceptance Criteria
- The canonical SQL reporting objects are named and scoped.
- The output shape for each major report is defined.
- The rollout order starts with the minimal set needed for accounting operations.
- The design is precise enough to guide migration and function work.
