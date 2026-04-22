---
owner: Codex
status: in_progress
last_reviewed: 2026-04-03
---

# OpenClaw Integration 01

## Purpose
This document captures the detailed integration plan for using the accounting platform safely through OpenClaw agents. It separates:

- plugin-only changes
- OpenClaw core changes
- accounting backend changes
- rollout phases and acceptance criteria

The goal is to make OpenClaw a safe orchestration shell for a multi-tenant accounting backend with approvals, auditability, and replay-safe mutations.

## Executive Summary
OpenClaw is a workable host for this platform, but it is not accounting-safe out of the box.

What is already strong in OpenClaw:
- tool discovery and inventory
- agent session and run model
- gateway request routing
- plugin hook system
- generic approval prompts
- run-level dedupe for `agent` requests

What is still weak for accounting use:
- tool-call context does not carry tenant or accounting correlation metadata
- approval payloads are generic and not domain-aware
- approval state is process-local and short-lived
- tool-level idempotency is not first-class
- host-side tool metadata is not rich enough to express accounting safety classes

Because of that, plugin-only integration is enough for a prototype, but production-grade accounting use requires targeted OpenClaw core changes.

## Integration Principles

### Principle 1: Backend Owns Accounting Truth
The accounting backend remains the source of truth for:
- tenant isolation
- approvals
- journal posting
- reporting
- audit trail
- idempotency

OpenClaw is an orchestration and interaction layer, not the accounting system of record.

### Principle 2: OpenClaw Must Carry Context End-to-End
Every accounting mutation should flow with enough metadata to preserve:
- actor identity
- tenant identity
- request identity
- approval identity
- replay protection
- audit correlation

### Principle 3: Read, Propose, Commit Are Different Classes
The integration should treat these as distinct categories:
- read tools
- proposal tools
- commit tools

They should not share the same authorization, approval, or risk posture.

### Principle 4: Approvals Must Be Durable
Generic transient prompts are insufficient for accounting. Approval state must resolve to a durable backend approval record.

## Plugin-Only Changes

These changes can be implemented without modifying OpenClaw core.

### Objective
Build a dedicated accounting plugin that talks to the accounting backend using the agent-safe API.

### Plugin Responsibilities
- expose accounting tools to OpenClaw
- require explicit tenant context
- pass backend request and idempotency metadata
- translate backend approval responses into OpenClaw-visible outcomes
- keep all accounting rules in the backend rather than reimplementing them in the plugin

### Recommended Tool Set

#### Read Tools
- `get_chart_of_accounts`
- `get_account_balance`
- `get_trial_balance`
- `get_balance_sheet`
- `get_profit_and_loss`
- `get_general_ledger`
- `get_balance_sheet_schedule`
- `list_unreconciled_schedule_accounts`
- `search_journal_entries`

#### Proposal Tools
- `create_journal_entry_draft`
- `validate_journal_entry`
- `reconcile_balance_sheet_schedule`
- `explain_schedule_variance`

#### Commit Tools
- `commit_journal_entry`
- `reverse_journal_entry`
- `approve_request`
- `reject_request`

### Plugin Input Rules
For all mutating tools:
- require `organization_id`
- require `request_id`
- require `idempotency_key`

For proposal and commit tools:
- require explicit intent-bearing payloads
- never infer tenant from ambient state alone

### Plugin Output Rules
All tool responses should preserve backend structure, including:
- `ok`
- `result`
- `errors`
- `warnings`
- `requires_approval`
- `human_summary`
- `machine_summary`
- backend `approval_request_id` when applicable

### What Plugin-Only Integration Can Support
- read-only accounting access
- schedule/report analysis
- proposal generation
- human-in-the-loop review
- backend-owned approval routing

### What Plugin-Only Integration Should Not Be Trusted For Yet
- durable approval lifecycle in OpenClaw itself
- advanced tenant/session binding at host level
- host-enforced accounting safety classes
- guaranteed replay-safe host behavior for mutating tool retries

## OpenClaw Core Changes

These changes are recommended for production-grade accounting-agent support.

### 1. Richer Tool Context

#### Problem
Current hook context is too generic for accounting controls.

#### Required Additions
Extend tool-call context and related events to carry:
- `firmId`
- `organizationId`
- `actorId`
- `actorType`
- `requestId`
- `correlationId`
- `idempotencyKey`
- `backendApprovalRequestId`
- `toolIntent`

#### Why
Without these, OpenClaw cannot:
- reliably gate accounting mutations
- correlate a tool call to a backend approval
- preserve tenant identity through retries and approvals

### 2. Structured Approval Payloads

#### Problem
The current approval request protocol is prompt-oriented and too shallow.

#### Required Additions
Extend `plugin.approval.request` with structured metadata:
- `organizationId`
- `firmId`
- `requestId`
- `idempotencyKey`
- `approvalRef`
- `actionType`
- `riskLevel`
- `preview`
- `metadata`

#### Why
Accounting approval decisions require more than a title and description. The operator must be able to inspect:
- what action is being approved
- for which tenant
- with what financial effect
- tied to which backend approval record

### 3. First-Class Tool Safety Metadata

#### Problem
Tool inventory currently focuses on labels and descriptions, not operational risk classification.

#### Required Additions
Allow tools to declare:
- `mutating`
- `readOnly`
- `proposalOnly`
- `approvalRequired`
- `tenantRequired`
- `auditCritical`
- `requiresIdempotency`

#### Why
This allows OpenClaw to:
- filter dangerous tools by profile
- warn before unsafe invocation
- demand tenant binding before execution

### 4. Session Tenant Binding

#### Problem
Accounting work often stays within one client company for a session, but the host has no first-class tenant session concept.

#### Required Additions
Add optional session metadata:
- `firmId`
- `organizationId`

#### Why
This makes it possible to:
- avoid repeated tenant selection prompts
- validate that mutating tools are running in the correct client context
- attach a stable tenant frame to audit and approval UX

### 5. Tool-Level Idempotency

#### Problem
OpenClaw has run-level dedupe for `agent` requests, but accounting writes need tool-level replay protection.

#### Required Additions
Introduce host support for:
- stable per-tool idempotency keys
- replay-safe mutation execution
- repeated-tool-call detection independent of the top-level run

### 6. Better Approval Persistence

#### Problem
Current approval state is in-memory and short-lived.

#### Recommended Direction
Option A:
- keep approval durability entirely in the backend
- OpenClaw carries backend `approval_request_id`
- OpenClaw approval UI becomes a frontend for backend approvals

Option B:
- add durable approval storage in OpenClaw

#### Recommendation
Use Option A. It matches accounting requirements better and avoids dual sources of approval truth.

### 7. Host Audit Event Export

#### Objective
Emit structured orchestration events for:
- tool requested
- approval requested
- approval resolved
- tool completed
- tool failed

#### Why
This lets the accounting platform correlate:
- host orchestration evidence
- backend audit entries
- operator decisions

## Backend Changes Required For OpenClaw Use

These are required regardless of OpenClaw changes.

### Required Backend Components
- `approval_requests`
- `idempotency_keys`
- `agent_proposals`
- policy engine
- tool execution/auth layer
- reporting views
- schedule engine
- org-consistency and closed-period enforcement

### Backend API Requirements

#### Read APIs
- safe to call broadly within tenant scope
- deterministic schemas
- no mutation side effects

#### Proposal APIs
- validate but do not commit
- return impact previews
- return approval requirement status

#### Commit APIs
- require idempotency
- return approval-required state when policy blocks direct commit
- tie every action to audit and approval records

### Backend Approval Model
The backend should remain authoritative for:
- approval request creation
- approval assignment
- approval resolution
- mutation permission after approval

OpenClaw should reference backend approval state, not replace it.

## Recommended Architecture

### Prototype Architecture
- OpenClaw accounting plugin
- accounting backend API
- backend-owned approvals
- OpenClaw generic approval UI as a lightweight bridge

This is sufficient for:
- read-only tools
- proposal tools
- manual review

### Production Architecture
- OpenClaw accounting plugin
- targeted OpenClaw core enhancements
- accounting backend API as system of record
- backend-owned approval and audit models
- structured tenant/correlation propagation end-to-end

## Rollout Phases

### Phase 1: Read-Only
Allowed:
- reports
- schedules
- ledger queries
- account search

Blocked:
- all accounting mutations

Acceptance:
- tenant scoping works
- audit context is preserved
- no write path exposed

### Phase 2: Proposal-Only
Allowed:
- draft journal proposals
- schedule reconciliation suggestions
- variance explanation

Blocked:
- direct posting
- reversal

Acceptance:
- proposals persist in backend
- operator can review them
- no mutation occurs without backend commit path

### Phase 3: Approval-Gated Commit
Allowed:
- commit tools only when approval policy permits
- backend approval reference carried through OpenClaw

Acceptance:
- durable backend approval linkage
- idempotent writes
- full audit correlation
- closed-period and tenant enforcement active

### Phase 4: Limited Auto-Commit
Allowed only for narrowly scoped, policy-approved actions such as:
- low-risk recurring entries
- trivial schedule state updates

Acceptance:
- proven idempotency
- proven audit trace
- explicit allowlist policy
- clear rollback/reversal procedure

## Recommended Implementation Order

### Step 1
Finish backend safety prerequisites:
- `idempotency_keys`
- `agent_proposals`
- reporting views
- schedule schema
- remaining ledger enforcement

### Step 2
Build the OpenClaw accounting plugin with:
- read tools
- proposal tools
- no direct commit tools yet

### Step 3
Validate operator workflow:
- can staff review proposals cleanly
- can tenant context be selected explicitly
- do audit links make sense

### Step 4
Implement targeted OpenClaw core changes:
- structured approval metadata
- richer tool context
- tool safety metadata
- tenant session binding

### Step 5
Enable approval-gated commit tools

### Step 6
Consider limited auto-commit only after production observation

## Acceptance Criteria

### For Plugin-Only Prototype
- OpenClaw can call read and proposal accounting tools
- every write-intent tool requires explicit tenant context
- backend remains approval and audit source of truth

### For Production Readiness
- OpenClaw carries tenant, request, and approval context end-to-end
- accounting commits are idempotent
- approvals are durable and backend-linked
- host and backend audit evidence can be correlated
- no accounting mutation can bypass tenant or approval policy

## Risks
- Building too much approval logic in OpenClaw would create a second source of truth.
- Relying only on plugin-level discipline without host metadata improvements will make future auditing and debugging harder.
- Enabling commit tools before idempotency and durable approval linkage are complete would be unsafe.

## Recommended Decision
- For prototype: no mandatory OpenClaw core changes yet.
- For production: make targeted OpenClaw core changes.
- Do not wait for every core enhancement before starting; build the backend and plugin first, then harden OpenClaw based on the proven flow.
