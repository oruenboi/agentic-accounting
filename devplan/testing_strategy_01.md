---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Testing Strategy 01

## Purpose
Define the test strategy for the accounting platform across code, database, API, workflow, background jobs, and agent integration layers. The goal is to make accounting correctness, tenant isolation, and replay safety verifiable before any production rollout.

## Testing Goals
- Prove ledger integrity before exposing write paths.
- Prove tenant isolation and policy enforcement before exposing client or agent access.
- Prove report correctness against canonical posted ledger data.
- Prove long-running jobs are replay-safe and failure-tolerant.
- Prove agent actions are constrained by approval, idempotency, and tenant context.
- Gate releases on a small set of accounting-critical invariants, not just generic application health.

## Test Layers

### Unit tests
Unit tests should validate pure logic in isolation.

Focus areas:
- domain posting rules
- account classification logic
- period-lock decision logic
- approval-policy evaluation
- schedule variance classification
- idempotency hashing and conflict detection
- audit summary rendering
- workflow state transitions

Recommended targets:
- `packages/domain`
- small pure helpers in backend services
- schema validation helpers in `packages/schemas`

### Integration tests
Integration tests should exercise service boundaries with a real database and application wiring.

Focus areas:
- journal draft creation and posting
- reversal creation
- approval submission and resolution
- report generation from posted data
- schedule generation and reconciliation
- attachment metadata and linking
- background job enqueue and completion
- agent tool execution path

Integration tests should verify that the backend behaves correctly as a system, not just as a set of mocked functions.

### Database and migration tests
Database tests should validate schema shape, constraint behavior, and migration safety.

Focus areas:
- migration applies cleanly from a fresh database
- migrations run in order from a clean state and from prior versions
- required tables, columns, and indexes exist
- foreign keys are correct
- check constraints are enforced
- trigger logic behaves as expected
- computed columns or generated defaults work properly

Migration tests must cover:
- audit schema
- tenant schema
- ledger schema
- ledger guard triggers
- approval header tables
- future idempotency and job tables

### RLS and policy tests
RLS tests should prove tenant separation and role-bound access.

Focus areas:
- a user can only read rows for organizations they belong to
- a firm member cannot access unrelated tenants
- client viewers cannot see restricted control data
- write paths are restricted to backend/service-role usage where intended
- audit and approval visibility respect role scope

Policy tests should be written against Postgres behavior, not only application guards.

### Accounting invariant tests
These are the most important tests in the system.

Required invariants:
- posted journal entries are balanced
- posted entries have at least two lines
- posted entries cannot be edited in place
- reversals create new balancing entries rather than mutating history
- accounting periods cannot overlap
- postings into closed periods are rejected
- trial balance totals reconcile from posted lines
- balance sheet totals tie out to assets = liabilities + equity
- schedule totals reconcile to their mapped GL balances or explicitly flag variance

These tests should fail loudly and block release if broken.

### API contract tests
API tests should verify request and response shapes for both human-facing and agent-facing surfaces.

Focus areas:
- request validation
- response envelopes
- error codes
- pagination and filtering
- approval-required responses
- idempotent replay responses
- tenant-scoped request handling

Agent tool contract tests should verify:
- tool schema discovery
- structured input validation
- structured output shape
- deterministic error codes
- approval flags and summaries

### Async job tests
Background job tests should verify queueing, retry, and recovery behavior.

Focus areas:
- job enqueue and claim behavior
- worker execution success and failure
- retry scheduling and backoff
- terminal failure handling
- stuck-job recovery
- job deduplication / idempotency
- linked audit and workflow side effects

Job tests should cover at least:
- schedule generation
- report export
- close precheck
- evidence pack generation

### Agent integration tests
Agent tests should verify that OpenClaw or equivalent agent flows cannot bypass accounting controls.

Focus areas:
- explicit organization context is required
- read tools are tenant-scoped
- proposal tools create durable proposals
- commit tools require approval when policy says so
- retries do not duplicate write effects
- agent run IDs and tool metadata are traceable

Agent tests should exercise the full chain:
- tool call
- validation
- policy check
- approval request
- commit or rejection
- audit linkage

## Suggested Test Suites

### Domain suite
Pure unit tests for:
- posting engine rules
- accounting sign logic
- report row classification
- schedule reconciliation math
- policy evaluation

### DB suite
Tests against a real Postgres instance for:
- migrations
- triggers
- RLS
- constraints
- seed behavior

### API suite
Tests for:
- REST endpoints
- tool execution endpoints
- error envelopes
- authorization behavior
- idempotency behavior

### Workflow suite
Tests for:
- approvals
- tasks
- exceptions
- close runs
- reopen flows

### Job suite
Tests for:
- job queueing
- retries
- locking
- recovery
- failure escalation

### Agent suite
Tests for:
- agent tool schemas
- approval-gated write flows
- read-only audit/report flows
- tenant isolation

## Recommended Fixtures
Use repeatable seeded fixtures for:
- one firm
- two organizations
- one internal firm admin
- one accountant
- one reviewer
- one client viewer
- chart of accounts with asset, liability, equity, revenue, and expense accounts
- open and closed accounting periods
- draft and posted journal entries
- approval request and action history
- schedule run with zero variance and one with variance

These fixtures make regression tests stable and fast to interpret.

## Release Gates
Do not release if any of the following fail:
- balance check on posted journals
- period-overlap guard
- posted-entry immutability
- RLS tenant isolation
- approval gating for material actions
- idempotent replay of write operations
- trial balance report correctness
- balance sheet tie-out
- schedule reconciliation behavior
- agent write-path approval enforcement

## Test Data Policy
- Use minimal synthetic data.
- Never use real client data in test fixtures.
- Keep fixtures deterministic.
- Keep accounting dates explicit and repeatable.
- Avoid overly broad "magic" seed scripts that hide what is being tested.

## CI Expectations
CI should run, at minimum:
- unit tests
- integration tests
- migration tests
- RLS/policy tests
- accounting invariant tests
- API contract tests

Later additions:
- async job tests
- agent integration tests
- end-to-end UI tests

## Failure Handling
When a test fails, the output should make it obvious whether the failure is:
- a domain invariant break
- a policy regression
- a migration regression
- a report correctness issue
- a job/worker failure
- an agent contract mismatch

Accounting tests are only useful if they tell the team exactly what broke.

## Non-Goals For V1
- exhaustive UI visual regression coverage
- performance benchmarking as a release gate
- load testing every background job path
- property-based testing for every domain rule on day one

Those can be added later, but they should not delay the core correctness suite.

## Implementation Sequence
1. Add unit tests for domain helpers and posting rules.
2. Add migration and DB constraint tests.
3. Add RLS and policy tests.
4. Add accounting invariant integration tests.
5. Add API contract tests for human and agent endpoints.
6. Add async job tests.
7. Add agent integration tests.
8. Wire the suite into CI release gates.

## Acceptance Criteria
- The repo has a clearly documented test pyramid for domain, database, API, workflow, jobs, and agents.
- Accounting invariants are explicitly listed and mapped to test coverage.
- RLS and tenant isolation are treated as first-class test targets.
- Agent and job flows are covered as production risks, not optional extras.
- Release gating is based on correctness and control, not just build success.
