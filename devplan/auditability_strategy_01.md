---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Auditability Strategy 01

## Purpose
Define the auditability strategy for the accounting platform as a standalone design. This document covers the control goals, immutable event model, provenance fields, approval and agent linkage, evidence retention, and operational review expectations that make the system suitable for accounting work.

## Audit Goals
The audit system must let the firm answer these questions reliably:
- what changed
- who changed it
- when it changed
- why it changed
- what approval, if any, was required
- which agent or system action triggered it
- what records or evidence support the change

The audit model should support:
- financial accountability
- reviewer traceability
- agent traceability
- control verification during month-end and year-end close
- evidence reconstruction for disputes or reviews

## Core Principles
- Posted accounting records are immutable.
- Corrections happen by reversal, supersession, or a new workflow event, not in-place overwrite.
- Audit events are append-only in normal operations.
- Audit records must remain tenant-scoped.
- The audit trail must be readable through the application layer, not only through raw database access.
- The audit trail must be specific enough to support both human review and agent investigation.

## Immutable Event Model
The system should treat audit events as the canonical history of control-relevant actions.

Recommended event structure:
- event name
- event version
- event timestamp
- actor type
- actor identity
- source channel
- request and correlation identifiers
- target entity reference
- optional parent entity reference
- action status
- approval linkage
- before state summary
- after state summary
- metadata payload

The immutable event model should support:
- successful actions
- failed actions
- rejected actions
- retried or replayed actions
- approval decisions
- system-generated workflow events

The audit trail should preserve the sequence of actions even when the final business outcome is a rejection or a no-op.

## Actor Provenance
Every audit event should capture who or what initiated the event.

Actor types:
- `user`
- `agent`
- `system`

Required provenance fields:
- actor type
- actor ID
- actor display name, when available
- user ID, when the actor is a human user
- agent name, when the actor is an agent
- agent run ID, when the actor is an agent
- tool name, when the actor is an agent tool call

Provenance rules:
- user-initiated actions must identify the human actor
- agent-initiated actions must identify the agent runtime and run
- system jobs must identify the job or subsystem where possible
- every action should be attributable without inference from free-text comments alone

## Source Provenance
The audit trail must also identify where the action came from.

Recommended source channels:
- `ui`
- `api`
- `agent_tool`
- `system_job`

Recommended source identifiers:
- request ID
- correlation ID
- idempotency key
- session ID, if applicable
- source route or endpoint

This allows the firm to trace an action from:
- UI click
- API request
- agent tool call
- background job execution

## Approval Linkage
Auditability must preserve the relationship between a control action and its approval trail.

The audit model should link:
- approval requests
- approval actions
- approved or rejected business entities
- the actor who submitted the approval request
- the actor who resolved it

Required approval concepts:
- approval-required action
- approval request created
- approval request resolved
- approval outcome
- approval reason or comments

Audit expectations:
- the approval request must be visible from the entity audit trail
- the approval actions must be visible in chronological order
- the final business action must reference the approval request that allowed it
- rejected approval outcomes must be preserved as part of history

## Agent Linkage
Because the platform is agent-enabled, auditability must make agent behavior explicit rather than anonymous.

Audit records for agent activity should capture:
- agent name
- agent run ID
- tool name
- tool input hash, if available
- backend request ID
- approval requirement state
- resulting entity IDs

The audit system should support answers to questions such as:
- which tool created this draft
- which agent run proposed this entry
- which agent action required human approval
- what entity the agent produced after approval

Agent actions should never be described only as generic API usage. The system needs durable, structured linkage between the agent run and the resulting accounting artifact.

## Report and Schedule Evidence
Auditability must extend beyond ledger mutations into reporting and schedule workflows.

The audit system should preserve:
- report generation events
- schedule generation events
- schedule reconciliation results
- close checklist events
- review and signoff events

Evidence objects to trace:
- report runs
- schedule runs
- schedule reconciliations
- close checklist runs
- report exports
- linked attachments

This allows the firm to reconstruct:
- what reports were generated
- which schedules supported those reports
- which reviewer approved them
- which supporting files were attached
- what remained open at close time

## Retention Expectations
Audit records should be retained according to the long-lived nature of accounting evidence.

Recommended retention rules:
- posted ledger audit events: long-lived or indefinite, subject to firm policy
- approval history: long-lived or at least aligned to accounting record retention
- schedule and report evidence: long-lived for close support
- agent action traces: long-lived if they affect accounting outputs
- transient operational telemetry: shorter retention may be acceptable if it does not affect accounting evidence

Recommended retention principles:
- do not hard-delete audit rows in normal operations
- preserve audit context for closed periods
- preserve evidence linked to final reports or signoff packs
- if a record must be removed for policy reasons, retain a deletion audit event

## Operational Review Expectations
Auditability is only useful if it can be inspected in practice.

The application should support review of:
- entity timelines
- approval timelines
- agent activity timelines
- period evidence packs
- report lineage

Operational review expectations:
- reviewers should see a readable summary, not raw JSON only
- filters should support organization, entity, actor, date range, and event type
- audit views should link to approvals, attachments, reports, schedules, and close objects
- audit records should help explain why a number or state exists, not just who touched it

## Review Scenarios

### Journal entry investigation
The reviewer should be able to answer:
- who created the draft
- who validated it
- who approved it
- who posted it
- whether it was later reversed
- what evidence supported it

### Schedule investigation
The reviewer should be able to answer:
- who generated the schedule
- whether it tied to the GL
- what variance, if any, remained
- who reviewed it
- what files supported it

### Period close investigation
The reviewer should be able to answer:
- what was open at close time
- which blockers were resolved
- who signed off
- what reports were generated
- what evidence pack supports the close

### Agent investigation
The reviewer should be able to answer:
- which agent run made the proposal
- what tool was invoked
- whether approval was required
- who approved it
- what entity resulted

## Relationship To Other Docs
This strategy depends on:
- `audit_read_model_01.md`
- `workflow_close_01.md`
- `document_model_01.md`
- `approval_requests` and `approval_actions`
- the ledger schema and immutable posting rules

It complements:
- reporting design
- schedule engine design
- OpenClaw integration design

## Non-Goals For V1
- full security information and event management platform
- raw event-stream analytics
- arbitrary audit log editing tools
- cross-firm forensic search across tenants

## Acceptance Criteria
- The audit strategy clearly defines what must be logged, why it matters, and how it is used operationally.
- The document distinguishes user, agent, and system provenance.
- The document defines how approvals, reports, schedules, and close evidence participate in auditability.
- The retention and operational review expectations are explicit enough to guide implementation.
- The strategy is detailed enough to support the schema and read-model design already documented in the repo.
