---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# OpenClaw Quickstart 01

## Purpose
Provide a practical quickstart for integrating the accounting platform with OpenClaw as an agent host. This document explains the intended plugin relationship, the required OpenClaw host capabilities or fork/upstream strategy, the backend prerequisites, tenant and auth expectations, the recommended deployment shape, and the current maturity boundaries.

## What OpenClaw Is In This Setup
OpenClaw is the agent orchestration layer.

It should be used for:
- agent tool routing
- human-in-the-loop approvals
- session and run context
- tool execution UX
- orchestration audit metadata

It should not be used as:
- the accounting source of truth
- the durable approval store
- the ledger mutation layer
- the tenant policy authority

Those responsibilities remain in the accounting backend.

## Integration Model
The integration is intentionally split into two parts:

### 1. OpenClaw plugin
The plugin lives with the accounting platform and exposes accounting tools to OpenClaw.

It should handle:
- tool registration
- tool schema exposure
- request translation
- backend API calls
- returning structured results and errors

### 2. OpenClaw host support
The OpenClaw host may need changes for production-grade accounting use.

Those changes are documented in `openclaw_integration_01.md` and `openclaw_distribution_hardening_01.md`.

The host is responsible for:
- agent session orchestration
- approval UX
- tool-call context propagation
- orchestration-level audit metadata

## Required Host Capabilities
For accounting use, OpenClaw should support:
- explicit tool metadata
- structured approval payloads
- tenant-aware tool context
- agent run and request correlation IDs
- durable or replayable approval references
- host-side approval prompts that map to backend approval state
- tool-call idempotency support

If those capabilities are not available upstream, use a companion fork or upstream the changes and pin to a supported host version.

## Recommended Host Strategy
For the initial OSS release, use a companion-fork/upstream-support stance:

- do not vendor the OpenClaw host into this repository
- ship the accounting plugin and integration docs from this repository
- use a companion fork when required host capabilities are not yet upstream
- upstream broadly useful host changes where practical
- pin a supported OpenClaw host version or companion-fork commit once validated

There are three realistic implementation strategies:

### Option 1: Companion fork
Maintain a separate OpenClaw fork for required host changes.

Use this when:
- host changes are substantial
- you want to control the release timing
- you do not want to wait on upstream review

This is the default initial OSS-release fallback when stock OpenClaw lacks required accounting controls.

### Option 2: Upstream contribution
Contribute the needed changes back to OpenClaw and depend on an upstream release.

Use this when:
- the changes are broadly useful
- upstream collaboration is realistic

### Option 3: Bundled vendor copy
Avoid unless absolutely necessary.

It makes maintenance and upgrades harder and is not the recommended default.

## Backend Prerequisites
Before OpenClaw can safely perform accounting work, the backend needs:
- authenticated agent client handling
- tenant validation
- approval requests and approval actions
- idempotency keys
- ledger posting engine
- reporting and schedule read APIs
- audit trails
- user/agent flow endpoints
- OpenClaw-friendly tool execution endpoints

The current backend already provides a first bounded slice for configured agent clients, delegated user context, tenant-scoped tool execution, journal draft/proposal workflow, approvals, posting, reversals, reporting reads, and audit timelines. Schedule runtime and the packaged OpenClaw plugin remain future work.

The backend remains the control plane for:
- posting
- approval state
- audit history
- reporting truth
- schedule reconciliation

## Auth And Tenant Context Expectations
Every accounting tool call should carry or derive:
- `organization_id`
- `request_id`
- `correlation_id`
- `idempotency_key` for mutating actions
- `agent_run_id` where applicable
- authenticated agent client identity

Rules:
- do not rely on implicit "current company" state alone
- validate tenant access before any business logic runs
- keep agent identity distinct from human user identity in audit and approval records
- delegated execution must preserve both the agent and human context when present

## Recommended Deployment Shape
The cleanest production topology is:

- reverse proxy / TLS terminator
- accounting API
- accounting workers
- accounting web app
- Postgres / Supabase-backed data layer
- object storage
- OpenClaw host

Data flow:
1. OpenClaw receives a user or agent request.
2. OpenClaw invokes an accounting plugin tool.
3. The plugin calls the accounting backend API.
4. The backend validates auth, tenant, approval, and idempotency.
5. The backend posts data, reads reports, or returns approval-required state.
6. OpenClaw presents structured results to the operator or agent.

## Quickstart Sequence

### Step 1: Set up the accounting backend
Prepare the accounting platform with:
- database migrations
- tenant records
- auth configuration
- required environment variables
- reporting and schedule APIs

### Step 2: Configure OpenClaw
Configure OpenClaw with:
- backend base URL
- plugin registration
- agent/client identity settings
- approval routing settings
- correlation/request ID propagation

### Step 3: Install the plugin
Use the accounting plugin package from this repo.

The plugin should expose tools such as:
- `get_trial_balance`
- `get_balance_sheet`
- `get_balance_sheet_schedule`
- `create_journal_entry_draft`
- `validate_journal_entry`
- `commit_journal_entry`

### Step 4: Bind an organization context
For every test or production session:
- select the target organization explicitly
- verify the caller has access
- confirm the requested tool is allowed for that tenant

### Step 5: Test read-only flows first
Start with:
- trial balance reads
- balance sheet reads
- schedule reads
- audit reads

Only move to proposal or commit tools after the read path is stable.

### Step 6: Enable approval-gated mutations
Use approval-required actions for:
- high-risk journal postings
- reversals
- period close actions
- schedule variances accepted with policy override

## Current Maturity
The current state is:
- architecture documented
- first backend workflow slice implemented
- first operator-console slice implemented
- plugin strategy defined
- host changes identified at a requirements level
- not yet ready for live autonomous accounting actions

The safe operating mode today is:
- read-only
- proposal-only
- approval-gated commit flows in a controlled environment

## Current Limitations
Do not assume the following are production-ready yet:
- fully durable agent-side approval storage
- complete OpenClaw host patch set
- production-hardening automation
- packaged OpenClaw plugin integration
- full schedule runtime
- broad operational runbooks and automated bootstrap

Until those are implemented and verified:
- keep mutations approval-gated
- keep tenant scope explicit
- keep the backend authoritative for approval and audit state

## Relationship To Other Docs
Use this document with:
- `openclaw_integration_01.md`
- `openclaw_distribution_hardening_01.md`
- `api_auth_client_model_01.md`
- `api_spec_v1_01.md`
- `packaging_distribution_01.md`

## Acceptance Criteria
- A reader can understand how OpenClaw fits into the accounting platform.
- The plugin role and host-role boundaries are explicit.
- The required host capabilities or fork/upstream strategy are stated clearly.
- Backend prerequisites and tenant/auth expectations are concrete.
- The document accurately describes current maturity and limitations without overstating readiness.
