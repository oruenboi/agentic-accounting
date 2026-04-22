---
owner: Codex
status: in_progress
last_reviewed: 2026-04-07
---

# Backend Processes 01

## Purpose
Define the operational map of backend processes for the accounting platform, including synchronous request handling, asynchronous workers, scheduled jobs, control processes, and agent-specific execution flows.

## Design Principles
- Accounting-critical decisions must remain deterministic and auditable.
- Not all backend behavior belongs in request/response handlers.
- Long-running or repeatable work should move into explicit worker or scheduled process paths.
- Every backend process must preserve tenant context, actor provenance, and approval/audit rules where relevant.
- Control and maintenance processes are part of the product design, not just deployment details.

## Backend Process Categories

The platform backend should be understood in five main categories:

1. synchronous request processes
2. asynchronous worker processes
3. scheduled or recurring processes
4. control and maintenance processes
5. agent-specific execution processes

## 1. Synchronous Request Processes
These run directly in the API or tool request path.

### Typical responsibilities
- authenticate caller
- resolve actor and tenant context
- enforce RBAC and policy
- validate requests
- create or update drafts
- evaluate approval requirements
- post approved ledger entries
- reverse posted entries
- serve reports and read models
- write audit events

### Examples
- `create_journal_entry_draft`
- `validate_journal_entry`
- `commit_journal_entry`
- `reverse_journal_entry`
- `get_balance_sheet`
- `get_balance_sheet_schedule`

### Design constraints
- must be transactional where accounting truth changes
- should remain fast and bounded
- should not perform heavy export or batch-generation work inline

## 2. Asynchronous Worker Processes
These are queue-backed or worker-driven processes that run outside the request lifecycle.

### Typical responsibilities
- schedule generation
- report export generation
- close checklist generation
- evidence pack generation
- future reconciliation suggestion jobs
- future OCR/document extraction

### Examples of job types
- `schedule.generate`
- `report.export`
- `close.precheck`
- `close.checklist.generate`
- `evidence_pack.generate`

### Design constraints
- must be replay-safe or clearly non-retriable
- should preserve tenant and actor context
- should emit audit and operational status events
- should create tasks or exceptions on terminal failure where appropriate

## 3. Scheduled Or Recurring Processes
These are time-triggered processes that should generally enqueue or invoke worker jobs rather than perform critical work directly.

### Typical responsibilities
- nightly or periodic close prechecks
- overdue approval reminders
- overdue task escalation
- stale-job recovery
- cleanup and retention jobs
- periodic status rollups

### Recommended model
- scheduler triggers the work
- background job system executes the work
- application state records the outcome

### What should not be scheduled blindly
- posting journals
- reversing entries
- approval decisions
- final close signoff

Those actions remain human- or request-driven.

## 4. Control And Maintenance Processes
These are backend processes that support safety, bootstrap, and operations.

### Typical responsibilities
- migration execution
- seed/bootstrap routines
- storage bucket creation
- backup verification
- health checks
- sequence setup
- secret and config validation
- log and metrics shipping hooks

### Why they matter
These processes are part of making the platform deployable and operable, especially as an OSS and self-hosted product.

## 5. Agent-Specific Execution Processes
Because the platform is designed for agent use, there are dedicated backend processes around tool execution.

### Typical responsibilities
- tool registry exposure
- tool request validation
- agent auth and tenant resolution
- idempotency acquisition and replay handling
- proposal persistence
- approval handoff
- audit enrichment with agent metadata
- optional async job dispatch for long-running tool requests

### Example sequence
1. agent tool request arrives
2. auth/client layer resolves agent identity
3. tenant enforcement runs
4. application service executes or queues work
5. approval policy applies
6. audit and response envelope emitted

## Supporting Data Integrity Processes
Some processes live at the database or invariant level rather than in services.

### Examples
- posted-entry balance checks
- posted-row immutability
- accounting period overlap prevention
- future org-consistency checks
- future closed-period posting checks

These are not "jobs," but they are still active backend control processes.

## Process Ownership Map

### API service owns
- request handling
- actor/tenant resolution
- validation orchestration
- posting and reversals
- read-model APIs

### Worker service owns
- background job execution
- long-running exports and generated artifacts
- retry and failure handling

### Scheduler owns
- recurring triggers
- periodic maintenance kickoffs

### Database owns
- low-level integrity constraints
- RLS
- triggers and SQL-level invariants

## Process Boundaries

### Synchronous vs async boundary
Move work to async when it is:
- export-heavy
- multi-step and long-running
- not required to complete the immediate request
- safely resumable

Keep work synchronous when it:
- changes accounting truth immediately
- must return a definite success/failure decision to the caller
- depends on current approval state at decision time

### Human vs system boundary
System processes may prepare, validate, or schedule.
Humans still own:
- approval decisions
- material accounting judgment
- final close signoff

### Agent vs backend boundary
Agents request and orchestrate through tools.
Backend processes remain the enforcement and execution layer.

## Recommended Service Topology

### `apps/api`
Owns:
- synchronous API and tool execution flows
- auth
- policy
- audit writing
- ledger posting

### `apps/workers`
Owns:
- background jobs
- exports
- generated artifacts
- async process retries

### scheduler layer
May live:
- inside workers
- or as a separate lightweight service

V1 can start with scheduler logic colocated with workers if kept simple.

## Observability Expectations
Each process category should expose enough signals for operations.

### Request processes
- latency
- failure rate
- auth failures
- approval-required outcomes

### Worker processes
- queue depth
- job retries
- terminal failures
- stuck jobs

### Scheduled processes
- last run
- next run
- success/failure state

### Control processes
- migration history
- backup validation status
- bootstrap/setup success

## Risks
- mixing too much heavy work into request handlers
- allowing scheduled jobs to mutate accounting truth without sufficient controls
- treating worker failures as invisible background noise
- losing tenant/actor context in async flows

## Dependencies
- background job architecture
- workflow/close design
- application logic layering
- ledger posting engine
- auditability strategy
- API auth/client model

## Acceptance Criteria
- The backend is described as a set of coordinated process classes rather than a monolithic API.
- The distinction between synchronous, async, scheduled, maintenance, and agent-specific work is explicit.
- The document identifies what must remain synchronous and what should be worker- or scheduler-driven.
- The process model is detailed enough to guide future service layout and operational implementation.
