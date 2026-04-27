---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Agent Tool Execution 01

## Purpose
Define the implementation-facing execution model for agent tools, including tool registry shape, request envelope, authentication, tenant enforcement, approval hooks, and idempotent write behavior.

## Design Principles
- Tools are explicit contracts, not free-form prompts.
- The backend owns tool execution and enforcement.
- Agent tooling must always be tenant-scoped and auditable.
- Mutating tools should be idempotent and approval-aware.
- Tool execution should map cleanly into application services.

## Tool Registry
The backend should expose a registry of tools with stable names and schemas.

Recommended tool registry properties:
- `name`
- `description`
- `input_schema`
- `output_schema`
- `mutability`
- `requires_approval`
- `requires_tenant`
- `idempotent`
- `category`

Suggested categories:
- `read`
- `proposal`
- `commit`
- `explain`
- `workflow`

## Execution Endpoints
Implemented endpoints under the API v1 prefix:
- `GET /api/v1/agent-tools/schema`
- `GET /api/v1/agent-tools/tool/:toolName`
- `POST /api/v1/agent-tools/execute`
- `POST /api/v1/agent-tools/execute-batch`

These should be thin wrappers over backend services, not business logic containers.

## Request Envelope
Suggested request shape:

```json
{
  "tool": "get_balance_sheet",
  "input": {
    "organization_id": "org_123",
    "as_of_date": "2026-03-31"
  },
  "request_id": "req_123",
  "idempotency_key": "idem_123",
  "correlation_id": "corr_123"
}
```

Write tools should require:
- `organization_id`
- `request_id`
- `idempotency_key`

## Authentication And Tenant Enforcement
The current implementation supports two caller classes:

- Supabase user bearer token via `Authorization: Bearer <token>`
- configured agent client credentials via `x-agent-client-id` and `x-agent-client-secret`

Agent-client calls may include:

- `x-delegated-auth-user-id` for tenant-scoped delegated user context
- `x-agent-run-id` for OpenClaw or agent-run correlation

Execution flow:
1. authenticate caller
2. resolve actor context
3. resolve tool metadata
4. validate tenant access
5. validate request schema
6. evaluate approval and idempotency behavior
7. dispatch to application service

The backend should normalize:
- `actor_type`
- `actor_id`
- `client_id`
- `agent_name`
- `agent_run_id`
- `firm_id`
- `organization_id`

For the current bounded agent-client path, `x-delegated-auth-user-id` is required whenever a tenant-scoped tool needs to prove organization access through the delegated user. This keeps agent identity separate from tenant authorization while preserving a route for OpenClaw-run correlation.

## Approval Hooks
For risky or material writes:
- tool execution may create or reference `approval_requests`
- backend must return `requires_approval = true` where appropriate
- the approval record remains the source of truth

Approval-aware tools include:
- posting journals
- reversing journals
- close-period actions
- variance acceptance
- high-risk agent proposals

## Idempotency Hooks
Every mutating tool should pass through idempotency handling.

Rules:
- same key and same normalized payload should replay safely
- same key and different payload should conflict
- tool execution should return stored result when replayed

## Mapping To Application Services
Tool handlers should delegate to:
- reporting services for reads
- ledger posting engine for accounting mutations
- workflow services for tasks and exceptions
- schedule services for schedule generation
- approval services for approval requests

Tool handlers should not:
- calculate ledger balances directly
- bypass approval policy
- write posted rows directly

## Tool Result Envelope
Recommended result fields:
- `ok`
- `result`
- `warnings`
- `errors`
- `requires_approval`
- `request_id`
- `human_summary`
- `machine_summary`

## Error Model
Recommended tool errors:
- `UNKNOWN_TOOL`
- `TOOL_INPUT_INVALID`
- `TENANT_ACCESS_DENIED`
- `APPROVAL_REQUIRED`
- `IDEMPOTENCY_CONFLICT`
- `TOOL_EXECUTION_FAILED`
- `INTERNAL_ERROR`

## OpenClaw Relationship
OpenClaw should be able to call these tools through the accounting plugin, but OpenClaw should not own the authoritative accounting state.

The plugin should:
- register tool metadata
- pass context and identifiers
- surface structured results and approval requirements

The backend should:
- enforce tenant scope
- enforce approvals
- store audit records
- own idempotent execution

## OpenClaw Readiness Position
The first OpenClaw-ready backend model is now defined and partially implemented:

- tool discovery is exposed through `GET /api/v1/agent-tools/schema`
- single and batch execution are exposed through API endpoints
- user and configured-agent auth paths share the same execution surface
- tenant access remains enforced in backend services
- mutating journal workflow tools use backend idempotency and approval state
- `x-agent-run-id` gives the OpenClaw host a correlation hook without making OpenClaw the accounting source of truth

Remaining OpenClaw-specific work:

- package the OpenClaw plugin
- pin a supported OpenClaw host version or companion-fork commit
- add richer host-side tenant/session and approval metadata once the host strategy is validated
- expand tool metadata if the plugin needs stricter safety declarations than the current registry exposes

## Batch Execution
Batch execution should be supported, but each item remains independently valid.

Rules:
- batch does not imply one atomic transaction across all items
- partial success should be represented per item
- each mutating item must still respect idempotency and approval checks

## Dependencies
- API auth/client model
- application logic layering
- approval behavior
- idempotency design
- OpenClaw integration design

## Acceptance Criteria
- Tool registry and execution endpoints are clearly defined.
- Tenant and auth enforcement are explicit.
- Approval and idempotency behavior are part of the execution contract.
- Tool handlers are mapped to backend services rather than acting as business logic islands.
