---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Storage Blueprint 01

## Purpose
Define the concrete storage layout for the multi-tenant, agent-enabled accounting platform, including relational tables, object storage buckets, data classification, retention expectations, and the split between raw tables, views, materialized views, and snapshots.

## Storage Principles
- Postgres is the canonical source of truth for accounting, approvals, workflows, and audit metadata.
- Object storage is for binary artifacts and exported evidence, not for accounting truth.
- Cached or derived data must be disposable and reproducible from canonical sources.
- Tenant isolation must be preserved consistently across database rows and object paths.
- Posted accounting records must never depend on caches, local files, or transient memory.

## Storage Layers

### Canonical relational storage
Use `Supabase Postgres` for:
- tenant entities
- access control
- accounting records
- approval and workflow state
- audit metadata
- attachment metadata
- idempotency records

### Object storage
Use `Supabase Storage` for:
- uploaded source documents
- bank statements
- working papers
- exported reports
- audit artifacts too large for relational rows

### Derived relational storage
Use SQL views, functions, and eventually materialized views for:
- reporting
- schedule reconciliation support
- dashboards and repeated read patterns

### Deferred cache / coordination layer
Redis is not part of v1.

If introduced later, it should be used only for:
- cache
- distributed locks
- queue coordination
- short-lived agent state

It must never become a system of record.

## Canonical Table Inventory

### Platform and tenancy tables
- `firms`
- `users`
- `firm_members`
- `organizations`
- `organization_members`
- `organization_settings`
- `organization_sequences`

Purpose:
- define tenant boundaries
- define access scope
- define organization-specific settings and numbering

### Ledger and accounting control tables
- `accounting_periods`
- `accounts`
- `journal_entry_drafts`
- `journal_entry_draft_lines`
- `journal_entries`
- `journal_entry_lines`
- `journal_entry_reversals`

Purpose:
- hold draft and posted accounting records
- enforce period and posting controls

### Approval and agent workflow tables
- `approval_requests`
- `approval_actions`
- `agent_proposals`
- `idempotency_keys`

Purpose:
- gate material changes
- capture durable agent intent
- prevent duplicate mutations

### Reporting and schedule tables
- `report_runs`
- `schedule_definitions`
- `schedule_runs`
- `schedule_run_rows`
- `schedule_reconciliations`

Purpose:
- persist generated evidence and review state
- preserve close support outputs

### Operational workflow tables
- `workflow_tasks`
- `exceptions`
- `close_checklist_runs`
- `close_checklist_items`

These are not implemented yet, but the storage model should reserve them as first-class operational records rather than ad hoc app state.

### Audit and attachment tables
- `audit_logs`
- `attachments`
- `attachment_links`

Purpose:
- preserve action history
- map files to business entities

## Table Classification

### High-sensitivity financial system-of-record
- `organizations`
- `organization_settings`
- `organization_sequences`
- `accounting_periods`
- `accounts`
- `journal_entry_drafts`
- `journal_entry_draft_lines`
- `journal_entries`
- `journal_entry_lines`
- `journal_entry_reversals`

Handling requirements:
- strict RLS
- backup priority
- no direct client-side writes to posted records
- no hard deletes for posted records

### High-sensitivity workflow and control data
- `approval_requests`
- `approval_actions`
- `agent_proposals`
- `idempotency_keys`
- `schedule_runs`
- `schedule_run_rows`
- `schedule_reconciliations`
- `workflow_tasks`
- `exceptions`
- `close_checklist_runs`
- `close_checklist_items`

Handling requirements:
- tenant-scoped access
- strong audit linkage
- preservation of historical decision records

### Sensitive identity and access data
- `users`
- `firm_members`
- `organization_members`

Handling requirements:
- minimal exposure
- audited role changes
- strong backend authorization checks

### Sensitive audit and evidence metadata
- `audit_logs`
- `attachments`
- `attachment_links`
- `report_runs`

Handling requirements:
- append-only or tightly controlled writes
- long retention
- strong queryability by tenant, entity, and time

## Required Tenant Columns
Every tenant-owned relational table should include:
- `firm_id`
- `organization_id`

Exceptions:
- truly global tables such as `users`
- firm-only tables such as `firm_members`

Reason:
- simplifies cross-table filtering
- simplifies RLS
- simplifies firm-level operations and support queries

## Object Storage Buckets

### Recommended v1 buckets
- `client-documents`
- `bank-statements`
- `working-papers`
- `report-exports`
- `audit-artifacts`

### Path convention
All object paths should include firm and organization context.

Recommended pattern:

```text
firm/{firm_id}/org/{organization_id}/{bucket_category}/{year}/{month}/{file_name}
```

Examples:

```text
firm/firm_001/org/org_123/client-documents/2026/03/invoice-1001.pdf
firm/firm_001/org/org_123/bank-statements/2026/03/main-account-mar.pdf
firm/firm_001/org/org_123/working-papers/2026/03/ar-support.xlsx
firm/firm_001/org/org_123/report-exports/2026/03/balance-sheet-2026-03-31.pdf
firm/firm_001/org/org_123/audit-artifacts/2026/04/agent-req-001.json
```

Rules:
- do not mix organizations under flat paths
- do not rely on user-provided folder structure
- keep file metadata in Postgres even when the binary is in storage

## Attachment Metadata Model

### `attachments`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `storage_bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `byte_size`
- `uploaded_by_actor_type`
- `uploaded_by_actor_id`
- `uploaded_at`
- `checksum`
- `status`

### `attachment_links`
Suggested fields:
- `id`
- `attachment_id`
- `linked_entity_type`
- `linked_entity_id`
- `link_purpose`
- `created_at`

Purpose:
- allow one uploaded file to be linked to one or more entities
- support invoices, approvals, journal drafts, schedules, close packs, and audit artifacts

## Raw Tables vs Views vs Materialized Views

### Raw tables
Use raw tables for:
- canonical transactions
- approvals
- agent proposals
- tasks and exceptions
- attachment metadata
- audit logs

These tables are the record of state and decisions.

### Views
Use plain SQL views for:
- canonical reporting logic
- open approval queues
- schedule variance dashboards
- read-safe joins across commonly queried entities

Suggested examples:
- `v_posted_journal_lines`
- `v_trial_balance`
- `v_balance_sheet`
- `v_profit_and_loss`
- `v_general_ledger_lines`
- `v_pending_approvals`
- `v_schedule_variances`

Use views when:
- the result must always reflect current canonical data
- performance is acceptable without precomputation

### Materialized views
Do not start with these unless required.

Likely future candidates:
- `mv_account_daily_balances`
- `mv_account_monthly_balances`
- `mv_org_reporting_status`

Use materialized views only when:
- the same queries are repeated frequently
- raw view performance becomes a bottleneck
- refresh logic is operationally manageable

### Snapshot tables
Use tables, not materialized views, when preserving point-in-time evidence:
- `report_runs`
- `schedule_runs`
- `schedule_run_rows`
- close evidence tables later

These are historical artifacts, not just performance helpers.

## Retention Rules

### Indefinite or long-lived financial truth
- `journal_entries`
- `journal_entry_lines`
- `journal_entry_reversals`
- `accounts`
- `accounting_periods`

Retention:
- retain indefinitely or per firm policy
- no hard delete in normal operations

### Long-lived workflow and audit records
- `approval_requests`
- `approval_actions`
- `agent_proposals`
- `audit_logs`
- `schedule_runs`
- `schedule_run_rows`
- `schedule_reconciliations`
- close-related tables later

Retention:
- target at least 7 years
- retain longer if firm policy or audit requirements justify it

### Operational replay and coordination records
- `idempotency_keys`

Retention:
- short to medium term
- recommended 7 to 30 days minimum for replay safety

### Attachments and stored artifacts
- source documents
- statements
- working papers
- close exports

Retention:
- follow firm retention policy
- source accounting support documents are typically multi-year records
- close evidence should be preserved with the related accounting period

## Delete and Immutability Rules

### Never hard-delete in normal workflows
- posted ledger records
- approvals once issued
- audit logs
- close evidence snapshots

### Prefer status transitions or archival fields
Recommended fields:
- `status`
- `archived_at`
- `superseded_by`
- `reversed_by`

### Files
- metadata can be soft-hidden from normal UI flows
- underlying object deletion should be policy-driven and admin-controlled

## Backup and Recovery Expectations
- Postgres backups must cover all canonical accounting, workflow, and audit tables.
- Point-in-time recovery should be enabled if available in the chosen Supabase tier.
- Object storage should preserve report exports and close support artifacts.
- Recovery procedures must restore relational metadata and storage references together.

## Access Control Expectations

### Postgres
- RLS on all tenant-owned tables
- backend-controlled writes for finance-sensitive tables
- least-privilege access for UI and agent read paths

### Storage
- bucket access must align with tenant membership
- backend should broker uploads for sensitive evidence flows where possible
- attachment metadata is the authoritative map from file to entity

## Deferred Items
Not required in v1, but the storage blueprint should leave room for them:
- bank transaction ingestion tables
- customer and vendor subledger tables
- report snapshot packs
- queue/worker-specific operational tables
- document OCR or extraction result tables

## Dependencies
- tenant model and RLS foundation
- audit model
- reporting design
- schedule engine design
- file/document model

## Acceptance Criteria
- The storage blueprint clearly separates canonical transactional data, object storage, derived reporting data, and transient future cache concerns.
- The document defines the expected table families for accounting, workflow, audit, reporting, and attachments.
- The bucket structure includes firm and organization scoping.
- The blueprint defines what should be raw tables, views, materialized views, and snapshots.
- Retention and deletion expectations are explicit enough to guide future schema and storage decisions.
