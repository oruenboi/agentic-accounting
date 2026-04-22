---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Workflow And Close Design 01

## Purpose
Define the v1 operational workflow model for tasks, exceptions, and accounting-period close. This document covers queue states, ownership, review flow, escalation expectations, and how operational workflow ties into approvals, schedules, reporting, and agent activity.

## Design Principles
- Workflow state is an explicit first-class backend concern, not a frontend convenience layer.
- Tasks and exceptions coordinate work; they do not replace accounting records.
- Period close must be gate-driven and evidence-driven.
- Agent-generated work should enter the same queueing and review model as human-generated work.
- Every close-critical action should be traceable to an owner, reviewer, and timestamp.

## Core Concepts

### Task
A unit of operational work assigned to a person or role.

Examples:
- review approval request
- investigate schedule variance
- complete bank reconciliation
- prepare month-end accrual

### Exception
A workflow object representing something that does not meet expected controls or reconciliation conditions.

Examples:
- schedule variance not equal to zero
- ambiguous bank match
- missing supporting document
- posting attempt into a closed period

### Close Checklist Run
A period-specific workflow object representing the close process for one organization and one accounting period.

### Close Checklist Item
A concrete checklist step within a close run.

Examples:
- all bank schedules generated
- all close-critical approvals resolved
- AR schedule reconciled
- P&L generated and reviewed

## V1 Workflow Object Set
- `workflow_tasks`
- `exceptions`
- `close_checklist_runs`
- `close_checklist_items`

These are not yet implemented, but they should be treated as required schema targets for the operational layer.

## Task Model

### `workflow_tasks`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `task_type`
- `title`
- `description`
- `status`
- `priority`
- `owner_user_id`
- `owner_role`
- `created_by_actor_type`
- `created_by_actor_id`
- `related_entity_type`
- `related_entity_id`
- `due_at`
- `sla_due_at`
- `completed_at`
- `completed_by_user_id`
- `metadata`
- `created_at`

Recommended statuses:
- `open`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

Recommended priorities:
- `low`
- `medium`
- `high`
- `critical`

Purpose:
- route work to the right reviewer or preparer
- support queue views for firm staff
- capture close-critical work completion state

## Exception Model

### `exceptions`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `exception_type`
- `severity`
- `status`
- `title`
- `description`
- `source_entity_type`
- `source_entity_id`
- `detected_by_actor_type`
- `detected_by_actor_id`
- `assigned_to_user_id`
- `resolved_at`
- `resolved_by_user_id`
- `resolution_notes`
- `metadata`
- `created_at`

Recommended statuses:
- `open`
- `under_review`
- `resolved`
- `accepted`
- `dismissed`

Recommended severities:
- `info`
- `warning`
- `high`
- `critical`

Difference from tasks:
- an exception represents a control issue or variance
- a task represents work to be done

An exception may create one or more tasks, but they should not be collapsed into the same table.

## Close Checklist Model

### `close_checklist_runs`
Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `accounting_period_id`
- `status`
- `started_at`
- `started_by_user_id`
- `submitted_for_signoff_at`
- `submitted_for_signoff_by_user_id`
- `closed_at`
- `closed_by_user_id`
- `reopened_at`
- `reopened_by_user_id`
- `metadata`
- `created_at`

Recommended statuses:
- `open`
- `in_progress`
- `pending_signoff`
- `closed`
- `reopened`

### `close_checklist_items`
Suggested fields:
- `id`
- `close_checklist_run_id`
- `item_code`
- `title`
- `description`
- `status`
- `required`
- `owner_user_id`
- `reviewer_user_id`
- `completed_at`
- `completed_by_user_id`
- `notes`
- `metadata`

Recommended item statuses:
- `not_started`
- `in_progress`
- `blocked`
- `completed`
- `waived`

## Task Generation Rules
Tasks should be created automatically for significant workflow events.

Suggested v1 task generators:
- approval request created -> approval review task
- schedule variance detected -> variance investigation task
- agent proposal requires approval -> reviewer task
- close checklist run started -> checklist item tasks or dashboard items
- unresolved exception nearing due date -> escalation task

Manual task creation should still be allowed for firm operations.

## Exception Generation Rules
Exceptions should be created automatically when control conditions fail.

Suggested v1 exception triggers:
- non-zero schedule variance
- ambiguous agent disambiguation result
- missing attachment on approval-required action
- failed close precondition
- attempt to close period with unresolved critical items

Exception creation should not mutate accounting records. It should create operational follow-up only.

## Ownership Model
Tasks and exceptions should support assignment by:
- specific user
- role-based queue
- unassigned pool within an organization

V1 recommendation:
- allow both `owner_user_id` and `owner_role`
- if both are null, the item sits in an organization-level unassigned queue

This is important because some firms work from team queues before assigning named owners.

## SLA and Escalation
V1 does not need a full escalation engine, but the data model should support it.

Suggested fields:
- `due_at`
- `sla_due_at`
- `severity`
- `priority`

Suggested behaviors:
- overdue high-priority approval tasks rise in queue views
- unresolved close-critical exceptions block period close
- critical exceptions cannot be dismissed without reviewer-level permission

## Close Process Design

### Close checklist purpose
The close checklist is the operational controller for month-end or year-end close. It ensures that schedule review, approvals, reporting, and lock actions happen in a controlled order.

### Minimum v1 close checklist items
- all close-period journal postings finalized
- all approval-required entries resolved
- trial balance generated
- balance sheet generated
- profit and loss generated
- required schedules generated
- required schedules reconciled or approved with variance
- critical exceptions resolved
- reviewer signoff complete

### Close states
1. `open`
2. `in_progress`
3. `pending_signoff`
4. `closed`
5. `reopened`

### Close transition rules
- a close run starts in `open`
- it moves to `in_progress` when checklist work begins
- it moves to `pending_signoff` only when all required checklist items are complete or explicitly waived
- it moves to `closed` only when signoff is approved
- reopening requires elevated permission and should create an audit event and follow-up exception/task if needed

## Close Blockers
The system should block close when any of these remain unresolved:
- open critical exceptions
- pending approval requests tied to the period
- unreconciled required schedules
- missing required reports
- unresolved close checklist items marked required

The close engine should expose blockers explicitly rather than leaving users to infer them.

## Signoff Model
V1 signoff can be simple but explicit.

Recommended roles:
- preparer
- reviewer
- closer

Minimum metadata:
- who prepared the close package
- who reviewed it
- who executed final close
- when each step occurred

The final close action should also lock the accounting period or trigger the lock workflow immediately after signoff.

## Relationship to Approvals
- approval requests remain separate domain objects
- approval-related tasks route work to reviewers
- unresolved approval requests can block close
- approval completion can auto-complete related tasks where appropriate

## Relationship to Schedules
- schedule generation can auto-create checklist items or satisfy them
- schedule variances create exceptions
- zero-variance schedule review can mark checklist items complete
- non-zero variance requires either correction or explicit approved acceptance

## Relationship to Agent Flows
Agents should be able to:
- create tasks indirectly by producing proposals or exceptions
- read open tasks and open exceptions
- help resolve items by preparing drafts, schedules, or analyses

Agents should not be allowed to:
- close periods autonomously
- dismiss critical exceptions without approval
- mark reviewer-only checklist items complete unless policy explicitly allows it

## Queue Views
The backend should support queue-oriented reads such as:
- my open tasks
- organization exceptions
- period close blockers
- overdue approvals
- pending signoff closes

These queues should be available to both UI and future agent tools through canonical application services.

## Suggested API / Tool Alignment

Internal API candidates:
- `GET /api/v1/tasks`
- `POST /api/v1/tasks/:id/claim`
- `POST /api/v1/tasks/:id/complete`
- `GET /api/v1/exceptions`
- `POST /api/v1/exceptions/:id/resolve`
- `GET /api/v1/close-runs`
- `POST /api/v1/close-runs`
- `POST /api/v1/close-runs/:id/submit-for-signoff`
- `POST /api/v1/close-runs/:id/close`
- `POST /api/v1/close-runs/:id/reopen`

Agent tool candidates:
- `get_open_tasks`
- `get_open_exceptions`
- `get_close_blockers`
- `generate_close_checklist`
- `submit_close_for_signoff`

Commit-like close actions should remain approval- and permission-gated.

## Non-Goals For V1
- full BPMN-style workflow engine
- multi-step dynamic SLA escalation automation
- cross-organization close orchestration in one transaction
- complex dependency graphs between all task types

## Dependencies
- approval model
- reporting design
- schedule engine design
- audit model
- tenant and RBAC model

## Implementation Sequence
1. Add `workflow_tasks`
2. Add `exceptions`
3. Add `close_checklist_runs`
4. Add `close_checklist_items`
5. Add queue query APIs
6. Link approval, schedule, and close blockers
7. Add signoff and reopen flows
8. Add tests for blocker enforcement and role permissions

## Acceptance Criteria
- The system can persist tasks, exceptions, close runs, and close checklist items as first-class workflow records.
- Approval requests, schedule variances, and agent escalations can create task or exception records predictably.
- The system can determine whether a period close is blocked and explain why.
- A close run records preparer, reviewer, and closer milestones.
- The workflow model is explicit enough to guide schema, API, and UI work without inventing ad hoc queue behavior later.
