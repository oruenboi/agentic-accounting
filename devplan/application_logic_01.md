---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Application Logic 01

## Purpose
Define the application logic layer for the accounting platform and make the service boundaries explicit. This layer coordinates requests, policy checks, transactions, and state transitions without duplicating domain rules or turning controllers into business logic.

## Layering Model

### 1. Controllers and tool handlers
Controllers and agent tool handlers are the ingress layer.

Responsibilities:
- parse requests
- validate shape and required fields
- resolve actor and tenant context
- call the appropriate application service
- return typed responses and errors

They must not:
- compute accounting balances
- decide posting rules
- manage ledger invariants directly
- implement approval routing logic inline

Examples:
- REST controller for human UI actions
- `/agent-tools` handler for OpenClaw-style execution

### 2. Application services
Application services orchestrate use cases.

Responsibilities:
- coordinate multi-step workflows
- call domain services in the correct order
- evaluate policy decisions
- start and commit transactions
- create or update workflow objects
- emit audit and task side effects

Application services answer questions like:
- what happens next
- is approval required
- what entity should be created or updated
- should this job be queued
- what should be returned to the caller

They must not:
- own the canonical accounting rules
- duplicate posting math
- spread the same state transition logic across controllers

### 3. Domain services
Domain services own accounting correctness.

Responsibilities:
- validate balanced postings
- enforce period rules
- enforce immutability and reversal behavior
- compute canonical balances or supported state transitions
- interpret accounting classifications consistently

Domain services should be pure or near-pure where practical.

They must not:
- know about HTTP
- know about OpenClaw
- know about UI routing
- know about persistence details beyond what is needed for domain integrity

### 4. Repositories
Repositories isolate persistence access.

Responsibilities:
- load and save aggregate data
- encapsulate query shapes
- translate between database rows and domain/application objects

They must not:
- decide whether a journal can be posted
- decide whether approval is required
- contain workflow branching logic

### 5. Policy evaluation
Policy evaluation is a first-class application concern.

Responsibilities:
- determine whether an action is allowed
- determine whether approval is required
- determine whether a risk threshold is exceeded
- determine whether an actor has sufficient scope for the target organization

Policy evaluation should be explicit and reusable.

Examples:
- `allowed`
- `approval_required`
- `denied`

Policy evaluation may use:
- actor role
- organization scope
- amount threshold
- account type
- period status
- source type

### 6. Transactions
Transactions protect atomic state changes.

Responsibilities:
- ensure a workflow either fully succeeds or fully fails
- protect draft-to-posted transitions
- protect approval resolution writes
- protect schedule reconciliation writes
- protect close transitions

Transaction boundaries should be placed at the application-service level, not in controllers.

### 7. State transitions
State transitions should be explicit and limited.

Responsibilities:
- move records through allowed lifecycle states
- reject invalid transitions early
- keep workflow states predictable
- make audit history easy to follow

State transitions should be modeled as:
- status enums
- transition rules
- application-service methods
- audit events

## Core Service Responsibilities

### OrganizationAppService
Handles:
- organization creation
- organization updates
- tenant metadata
- organization settings access

### PermissionService
Handles:
- role checks
- permission checks
- tenant scope validation
- operational policy gates

### ApprovalPolicyService
Handles:
- approval-required decisions
- risk-tier evaluation
- route-to-review decisions

### LedgerAppService
Handles:
- journal draft creation
- validation
- submission
- posting
- reversal

### ReportingAppService
Handles:
- report parameter normalization
- report execution
- report response shaping
- snapshot or export orchestration if needed

### ScheduleAppService
Handles:
- schedule generation
- schedule reconciliation
- variance handling
- review state updates

### ReconciliationAppService
Handles:
- matching workflows
- match suggestion routing
- confirmation or rejection of a match

### WorkflowTaskService
Handles:
- task creation
- task assignment
- task completion
- task status changes

### ExceptionService
Handles:
- exception creation
- exception assignment
- exception resolution
- exception escalation triggers

### AuditService
Handles:
- append-only audit event writes
- event normalization
- entity and actor linkage

### IdempotencyService
Handles:
- request replay checks
- duplicate suppression
- response replay for repeated mutations

### AgentToolExecutionService
Handles:
- agent tool dispatch
- schema validation
- mapping tool input to application services
- structured tool responses

## Workflow Patterns

### Read workflow
Pattern:
1. controller or tool handler receives request
2. auth and tenant context are resolved
3. application service reads through repository or reporting service
4. response is returned without mutation

### Draft workflow
Pattern:
1. request is validated
2. policy is evaluated
3. draft record is created
4. audit event is written
5. caller receives draft reference

### Submit workflow
Pattern:
1. draft is validated
2. policy is evaluated again if needed
3. approval request is created if required
4. state is updated inside a transaction
5. audit event and task side effects are created

### Commit workflow
Pattern:
1. approval and idempotency are verified
2. domain service validates invariants
3. posted state is written in one transaction
4. draft is closed or superseded
5. audit and follow-up records are written

### Reversal workflow
Pattern:
1. existing posted entity is loaded
2. reversal rules are validated
3. reversal entry is created
4. original entity remains immutable
5. audit records tie the reversal to the original

## State Transition Guidance

### Journal drafts
Typical states:
- `draft`
- `validated`
- `pending_approval`
- `approved`
- `posted`
- `rejected`

Guidance:
- do not allow arbitrary jumps unless the domain explicitly supports them
- posting should be the only path to final ledger truth

### Approval requests
Typical states:
- `pending`
- `approved`
- `rejected`
- `expired`

Guidance:
- decisions should be immutable events, not in-place semantic rewrites

### Schedule runs
Typical states:
- `generated`
- `variance_detected`
- `reconciled`
- `reviewed`

Guidance:
- a schedule may be reviewed even if variance exists, but the variance must remain visible

### Close runs
Typical states:
- `open`
- `in_progress`
- `pending_signoff`
- `closed`
- `reopened`

Guidance:
- close should only move forward when blockers are resolved or explicitly waived

## Error Handling
Application logic should return deterministic, typed errors.

Examples:
- `TENANT_ACCESS_DENIED`
- `APPROVAL_REQUIRED`
- `ENTRY_NOT_BALANCED`
- `PERIOD_LOCKED`
- `IDEMPOTENCY_CONFLICT`
- `INVALID_STATE_TRANSITION`

Errors should be:
- specific
- stable
- safe for both UI and agent callers

## Audit and Side Effects
Application services should centralize side effects.

Expected side effects:
- audit event creation
- approval request creation
- workflow task creation
- exception creation
- background job enqueueing

Side effects should be triggered intentionally from the application service, not implicitly from repository code.

## Implementation Rules
- Keep controllers thin.
- Keep application services explicit and named by use case.
- Keep domain services reusable and testable.
- Keep repositories persistence-only.
- Keep policy decisions separate from persistence and domain math.
- Put transactions around the use case, not the controller.
- Make state transitions a visible part of the service contract.

## Testing Expectations
Application logic should be tested at the use-case level for:
- permission checks
- approval gating
- state transitions
- transaction rollback behavior
- audit and task side effects
- idempotency behavior

## Dependencies
- tenant and RBAC model
- approval model
- ledger model
- reporting model
- workflow and close model
- audit model
- idempotency model

## Non-Goals
- UI composition
- SQL view implementation
- storage bucket layout
- worker queue implementation details
- document upload mechanics

## Acceptance Criteria
- The repo has a clear written separation between controllers, application services, domain services, repositories, policy evaluation, transactions, and state transitions.
- The document describes how core accounting workflows should be orchestrated without duplicating accounting rules.
- The application layer responsibilities are concrete enough to guide NestJS module and service design later.
