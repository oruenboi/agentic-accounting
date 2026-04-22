---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# API Auth And Client Model 01

## Purpose
Define the authentication, client identity, and request-trust model for the accounting platform across internal users, backend services, and agent clients such as OpenClaw integrations.

## Design Principles
- Authentication answers who is calling.
- Authorization answers what that caller may do within a tenant context.
- Tenant context must be explicit and validated for every financial action.
- Service and agent clients must not be treated like ordinary end-user sessions.
- The backend is the policy enforcement point even when database RLS exists underneath.

## Caller Types

### End-user session
Human user authenticated through Supabase Auth.

Examples:
- firm staff using the internal UI
- client users with limited viewer access

### Service client
Trusted backend-to-backend or internal automation client.

Examples:
- report export worker
- internal admin job runner
- controlled server-side integration

### Agent client
An authenticated non-human client acting through an agent runtime.

Examples:
- OpenClaw accounting plugin
- future MCP or tool-execution gateway

Agent clients need their own identity and policy handling, even when acting on behalf of a human.

## Identity Sources

### User authentication
Use `Supabase Auth` as the primary user identity source.

Expected flow:
- user signs in through Supabase
- UI obtains JWT
- backend verifies JWT
- backend resolves app-level `users` row and memberships

### Service authentication
Use a separate client credential model rather than reusing ordinary user tokens.

Recommended approach:
- service client ID
- client secret or signed token mechanism
- backend-maintained allowlist of scopes and permitted organizations or firms

### Agent authentication
Treat agent clients as named API clients with explicit scopes.

Recommended approach:
- dedicated `api_clients` or equivalent table later
- unique client identifier
- stored secret or public-key-backed verification
- optional human-initiated session binding for "agent acting for user X"

## Request Authentication Model

### Internal UI requests
- `Authorization: Bearer <supabase_jwt>`
- backend verifies token and loads actor identity

### Service client requests
- either:
  - `Authorization: Bearer <service_token>`
  - or signed client credential flow producing a short-lived token

V1 recommendation:
- short-lived signed tokens issued by backend or platform auth layer
- avoid long-lived static secrets in request flows where possible

### Agent requests
- authenticated as a named agent client
- optionally include delegated actor context if operating on behalf of a signed-in user

Recommended request context:
- `client_id`
- `agent_name`
- `agent_run_id`
- `request_id`
- `correlation_id`
- `organization_id`

## Actor Model
The application layer should normalize all authenticated callers into an actor context.

Suggested actor fields:
- `actor_type` (`user`, `agent`, `service`, `system`)
- `actor_id`
- `user_id` nullable
- `client_id` nullable
- `agent_name` nullable
- `agent_run_id` nullable
- `firm_id`
- `organization_id` nullable until tenant resolution completes
- `permissions`
- `scopes`

This normalized actor context should flow through:
- authorization
- audit logging
- approval evaluation
- idempotency
- job enqueueing

## Tenant Context Enforcement

### Core rule
Every financial request must resolve to a valid `organization_id` before business logic runs.

Sources of tenant context:
- explicit request field
- UI-selected organization from session context
- service-client permitted org list

### Validation steps
1. authenticate caller
2. resolve actor
3. resolve requested `organization_id`
4. confirm membership or allowed scope
5. load firm context
6. continue to authorization and business logic

For agent and service clients, do not rely on implicit "current org" state alone.

## Authorization Model

### User authorization
Use:
- app-level role and permission matrix
- organization membership
- optional firm-level elevated roles

### Service authorization
Service clients should have explicit scopes, not blanket admin rights.

Examples:
- `reports.generate`
- `schedules.generate`
- `jobs.execute`

### Agent authorization
Agent clients need both:
- client-level scopes
- tenant-specific permission enforcement

Important distinction:
- an agent client may be technically allowed to call a tool
- but still blocked from a specific organization or action by policy

## Delegated Agent Model
For agent use tied to a human operator, support delegated execution.

Recommended fields:
- `delegated_user_id`
- `delegated_session_id`
- `delegation_reason`

Rules:
- audit must preserve both the agent identity and the human initiator when delegation exists
- delegated execution must not exceed the human's permissions unless an explicit system policy allows it

## Client Registry Model
V1 should plan for a client registry table even if implementation comes later.

Suggested `api_clients` fields:
- `id`
- `firm_id` nullable
- `name`
- `client_type` (`service`, `agent`)
- `status`
- `secret_hash` or public key reference
- `allowed_scopes`
- `allowed_organization_ids` nullable
- `allowed_firm_ids` nullable
- `created_at`
- `rotated_at`
- `last_used_at`

Purpose:
- identify non-user callers
- constrain scope
- support rotation and revocation

## Claims And Token Expectations

### User JWT claims
Backend should rely on:
- verified subject from Supabase
- app-level user lookup

Do not trust role claims embedded only in the token unless the backend controls their issuance and freshness.

### Service and agent token claims
Suggested claims:
- `sub`
- `client_id`
- `client_type`
- `scopes`
- `firm_id` optional
- `organization_id` optional but not sufficient alone
- `exp`
- `iat`

Even if claims include tenant hints, the backend should still validate them against stored policy.

## Request Metadata Requirements
All mutating requests should carry:
- `request_id`
- `idempotency_key`
- `organization_id`

Agent and service requests should also carry where applicable:
- `correlation_id`
- `agent_run_id`
- `tool_name`

This is necessary for:
- auditability
- replay protection
- approval linkage
- operational debugging

## Trust Boundaries

### UI
Trusted for user interaction, not for permission decisions.

### OpenClaw or agent host
Trusted as an integration surface, not as the source of accounting approval truth.

### Backend API
Trusted enforcement point for:
- authn
- authz
- tenant validation
- approval policy
- audit writes

### Database
Defense in depth through RLS and constraints, not the only policy layer.

## Recommended API Patterns

### Internal UI
- authenticate with Supabase JWT
- backend resolves current user and memberships
- organization may come from explicit UI context

### Agent API
- authenticate client
- require explicit `organization_id` in tool input for financial operations
- require `request_id` and `idempotency_key` for write operations
- attach `agent_name`, `agent_run_id`, and `tool_name` into actor/audit context

### Service API
- authenticate service client
- restrict by scope and tenant
- prefer internal-only endpoints for operational actions

## Error Model
Recommended auth/client-related error codes:
- `UNAUTHENTICATED`
- `INVALID_TOKEN`
- `CLIENT_DISABLED`
- `TENANT_ACCESS_DENIED`
- `ORGANIZATION_NOT_FOUND`
- `INSUFFICIENT_PERMISSIONS`
- `INVALID_DELEGATION`
- `SCOPE_DENIED`

These should be stable across UI and agent surfaces.

## OpenClaw-Specific Considerations
- OpenClaw should authenticate as a named agent client, not as a generic user.
- If it acts for a human, delegated context should be explicit.
- OpenClaw request metadata should flow into audit and approval systems.
- OpenClaw should not be able to bypass backend approval state with host-side prompts alone.

## Non-Goals For V1
- full enterprise SSO design
- customer-managed identity federation
- fine-grained per-document client ACLs
- general OAuth authorization-server implementation

## Dependencies
- tenant/RBAC model
- auditability strategy
- approval behavior
- OpenClaw integration design
- idempotency design

## Implementation Sequence
1. add client registry schema
2. add backend auth middleware for user, service, and agent callers
3. add actor-context normalization
4. add tenant-context enforcement middleware/guards
5. add scope enforcement for client types
6. wire audit and approval systems to normalized actor context

## Acceptance Criteria
- The platform distinguishes user, service, and agent callers explicitly.
- Every financial request resolves and validates tenant context before business logic runs.
- Non-user clients have explicit identities and scopes rather than borrowed user semantics.
- Agent requests can be audited with client, run, tool, and delegated-user context where applicable.
- The auth/client model is detailed enough to guide future schema and backend implementation.
