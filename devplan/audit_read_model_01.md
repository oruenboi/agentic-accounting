---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Audit Read Model 01

## Purpose
Define how users, reviewers, and agents read and inspect audit history, approval history, entity lineage, and evidence links. This document focuses on the query and workflow model for audit consumption rather than the write-side audit schema itself.

## Design Principles
- Audit records must be inspectable without direct database access.
- Users should be able to answer "who changed what, when, why, and under what approval" from the application layer.
- Audit views must support both entity-level investigation and period-close evidence review.
- Agent-originated actions must be distinguishable from user-originated and system-originated actions.
- Read models should combine immutable audit events with relevant business context, not expose raw JSON only.

## Primary Audit Read Use Cases

### Entity investigation
Questions:
- who created this journal draft
- who approved this entry
- when was this schedule reviewed
- who reopened this period

### Approval traceability
Questions:
- which approval request gated this action
- who approved or rejected it
- what comments or policy reasons were recorded

### Agent traceability
Questions:
- which agent run created this proposal
- which tool was called
- whether the action was auto-allowed or human-approved
- what backend entity was produced

### Close evidence review
Questions:
- what happened during the close period
- which schedules were generated and reviewed
- which exceptions remained open
- which final signoff events occurred

### Report and schedule lineage
Questions:
- what journal entries support this reported amount
- which schedule run supports this balance sheet line
- which evidence files were attached

## Audit Read Surfaces

### Entity audit timeline
A chronological event feed for a single business entity.

Examples:
- journal draft timeline
- posted journal timeline
- approval request timeline
- schedule run timeline
- close checklist run timeline

Required output fields:
- `event_name`
- `event_timestamp`
- `actor_type`
- `actor_display_name`
- `action_status`
- `summary`
- `approval_request_id`
- `request_id`
- `correlation_id`
- relevant entity links

### Related audit graph
A linked view showing directly related entities and their audit trails.

Examples:
- journal draft -> approval request -> approval actions -> posted journal -> reversal
- schedule run -> schedule reconciliation -> exception -> approval -> close checklist item

This should not require the user to manually search each entity in isolation.

### Approval timeline view
A specialized read model focused on:
- approval request header
- approval actions in order
- linked target entity
- policy reason
- current state

### Agent activity view
A specialized read model for:
- `agent_name`
- `agent_run_id`
- `tool_name`
- `tool_input_hash`
- linked proposal, approval, or journal entity

### Period evidence view
A period-scoped read model showing:
- close checklist runs
- report runs
- schedule runs
- approvals
- exceptions
- major ledger postings

This is essential for month-end review.

## Canonical Read Objects

### `audit_event_view`
A normalized application-level object built from `audit_logs`.

Suggested fields:
- `audit_event_id`
- `firm_id`
- `organization_id`
- `event_name`
- `event_version`
- `event_timestamp`
- `actor_type`
- `actor_id`
- `actor_display_name`
- `user_id`
- `agent_name`
- `agent_run_id`
- `tool_name`
- `request_id`
- `correlation_id`
- `entity_type`
- `entity_id`
- `parent_entity_type`
- `parent_entity_id`
- `action_status`
- `approval_request_id`
- `approval_required`
- `summary`
- `before_state`
- `after_state`
- `metadata`

`summary` should be produced in the application layer from event context so the UI does not have to interpret raw event names everywhere.

### `approval_timeline_view`
Built from:
- `approval_requests`
- `approval_actions`
- optionally related `audit_logs`

Suggested fields:
- `approval_request_id`
- `status`
- `target_entity_type`
- `target_entity_id`
- `submitted_at`
- `submitted_by`
- `current_approver`
- `resolved_at`
- `resolved_by`
- `decision_reason`
- `policy_snapshot`
- `actions`

### `entity_lineage_view`
An aggregated read model that joins an entity to adjacent evidence.

Examples by entity:

For `journal_entry`:
- originating draft
- approval request
- audit timeline
- reversal entry
- linked attachments

For `schedule_run`:
- schedule definition
- reconciliation record
- linked exception
- review event timeline
- linked close checklist item

For `report_run`:
- report parameters
- generation event
- linked attachments
- related close run

## Query Patterns

### By entity
Inputs:
- `entity_type`
- `entity_id`

Returns:
- full timeline
- related approval context
- related attachments
- parent/child entity links where relevant

### By organization and time window
Inputs:
- `organization_id`
- `from_timestamp`
- `to_timestamp`
- optional `event_name`
- optional `actor_type`

Returns:
- filtered audit feed

### By approval request
Inputs:
- `approval_request_id`

Returns:
- approval header
- approval actions
- linked target entity summary
- linked audit events

### By agent run
Inputs:
- `agent_run_id`

Returns:
- all tool-execution-related audit events
- linked proposals
- linked approvals
- linked resulting entities

### By accounting period / close run
Inputs:
- `organization_id`
- `accounting_period_id` or `close_checklist_run_id`

Returns:
- key postings
- approvals
- schedules
- exceptions
- signoff events

## API Shape Expectations

Internal API candidates:
- `GET /api/v1/audit/events`
- `GET /api/v1/audit/entities/:entityType/:entityId`
- `GET /api/v1/audit/approvals/:approvalRequestId`
- `GET /api/v1/audit/agent-runs/:agentRunId`
- `GET /api/v1/audit/period-evidence`

Query filters should support:
- `organization_id`
- `event_name`
- `actor_type`
- `request_id`
- `correlation_id`
- `from_timestamp`
- `to_timestamp`

### Agent tool candidates
Read-only tools only:
- `get_audit_timeline`
- `get_approval_timeline`
- `get_entity_lineage`
- `get_period_evidence`

These are useful for investigative agents, but they should never mutate audit history.

## UI Expectations

### Audit timeline screen
Should support:
- filters by entity, period, actor, and event type
- a readable event summary
- expandable structured details
- links to related entities

### Approval detail screen
Should show:
- approval request header
- ordered approval actions
- linked target entity
- policy reason
- reviewer comments

### Entity detail sidebar / tab
Every major entity page should expose:
- recent audit timeline
- link to full audit history

### Close evidence pack view
Should group:
- reports
- schedules
- approvals
- critical postings
- unresolved or resolved exceptions

## Read Authorization
- audit reads must respect tenant boundaries
- not every org member should see every audit detail
- reviewer/admin-level roles may need broader access than bookkeepers or client viewers

Suggested permission split:
- `audit.read`
- `approval.read`
- `close.evidence.read`

Agent audit reads should also be tenant-scoped and role-scoped.

## Summary Rendering Rules
Do not force the UI to render raw event names and JSON.

The application layer should map audit events to:
- short human summary
- actor label
- status badge
- related entity badges

Example:
- `ledger.journal_entry.posted` -> `Journal entry JE-2026-000145 posted`
- `approval.request.rejected` -> `Approval request rejected by Reviewer A`
- `schedule.run.reconciled` -> `AR schedule reconciled with zero variance`

## Lineage Rules
Every major financial object should expose lineage to nearby control artifacts.

Required lineage examples:
- `journal_entry` -> `journal_entry_draft`, `approval_request`, `audit_logs`, `attachments`
- `approval_request` -> `approval_actions`, `audit_logs`, `target_entity`
- `schedule_run` -> `schedule_reconciliation`, `audit_logs`, `attachments`, `exceptions`
- `close_checklist_run` -> `close_checklist_items`, `audit_logs`, related schedules and reports

This is more useful than a flat audit feed alone.

## Evidence Pack Expectations
A future evidence-pack view should be able to assemble:
- audit timeline highlights
- approval history
- linked schedules
- linked report exports
- attachments

The audit read model should make that assembly straightforward through canonical APIs.

## Non-Goals For V1
- full SIEM or security log platform
- arbitrary event analytics engine
- cross-firm forensic dashboard
- write access to audit history

## Dependencies
- audit schema
- approval schema
- attachment model
- workflow/close model
- reporting and schedule models

## Implementation Sequence
1. Add audit query service in backend
2. Add entity timeline endpoint
3. Add approval timeline endpoint
4. Add period evidence endpoint
5. Add lineage joins for journals, schedules, and close runs
6. Add role-based audit read permissions
7. Add UI views for timeline and approval detail

## Acceptance Criteria
- Users can inspect an entity-specific audit timeline without raw SQL access.
- Approval history is readable as an ordered, linked decision trail.
- Agent-originated actions are identifiable by agent run and tool metadata.
- Period-close evidence can be queried as a coherent package rather than isolated rows.
- The read model exposes enough lineage to connect audit events, approvals, schedules, reports, and attachments.
