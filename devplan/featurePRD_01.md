---
owner: Codex
status: in_progress
last_reviewed: 2026-04-02
---

# Feature PRD 01

## Story
As the operator of an accounting-firm platform, I need an immutable audit trail for user and agent actions so that postings, approvals, and review workflows are traceable and defensible.

## Product Direction Confirmed
- The platform is multi-tenant by default, using `firm` and `organization` as the operating hierarchy.
- The source of truth is a double-entry ledger in Supabase Postgres.
- Posted ledger records are immutable and corrected by reversal only.
- The backend is being designed for agentic use, but OpenClaw-style agents are not yet production-ready against the current implementation.
- Agent rollout will be phased: read-only, then proposal-only, then approval-gated commit, then limited auto-commit.

## Acceptance Criteria
- The repo contains an initial Supabase migration for `audit_logs` and `approval_actions`.
- The schema captures actor, entity, request, approval, and source metadata.
- The schema includes indexes for common audit and approval lookups.
- The migration uses append-only-friendly structures and explicit integrity checks.
- The repo contains initial tenant, ledger, and ledger-guard migrations consistent with the confirmed accounting model.
- Planning docs capture the current OpenClaw readiness boundary and major remaining gaps.
- Planning docs capture the detailed OpenClaw integration split between plugin-only work, host-side changes, backend prerequisites, and rollout phases.
- Planning docs include a documentation inventory, architecture summary, and concrete v1 API spec.

## Dependencies
- Supabase Postgres as the transactional store.
- UUID generation support through Postgres/Supabase.

## Open Questions
- TODO(Owner: Codex, Due: 2026-04-02): Add the `approval_requests` header table and connect existing approval-related foreign key placeholders.
- TODO(Owner: Codex, Due: 2026-04-02): Define idempotency, agent proposal persistence, and policy-gated commit flow before any live agent write access.
- TODO(Owner: Codex, Due: 2026-04-02): Define reporting SQL and balance sheet schedule generation before declaring the reporting surface stable.
