# Agentic Accounting Roadmap

This project is currently in a documentation-complete, implementation-pending phase. The architecture, control model, OpenClaw integration approach, and release shape are documented; the runtime product still needs implementation.

## Current Phase

The current phase is:
- documentation and planning complete for the core architecture
- schema and control model largely specified
- implementation work still pending for the backend, UI, and runtime integrations
- release-facing docs prepared for OSS and self-hosted usage

The design center is an accounting control plane for firms, not a generic SMB bookkeeping app.

## What Is Already Documented

The following areas are now documented in the repo:
- multi-tenant `firm` / `organization` model
- ledger as source of truth
- double-entry posting engine and immutable posted entries
- approvals and auditability
- reporting and balance sheet schedules
- storage and document handling
- background jobs and close workflows
- API auth and client model
- OpenClaw integration and hardening strategy
- OSS packaging, self-hosting, and OpenClaw quickstarts

## What Is Still Implementation-Pending

The main implementation gaps are:
- `idempotency_keys` schema and runtime behavior
- `agent_proposals` schema and runtime behavior
- reporting SQL views and functions
- schedule schema and generation runtime
- agent tool execution/auth wiring
- org-consistency and closed-period enforcement in write paths

These are design-covered, but not yet built.

## Near-Term Milestones

1. Build the backend skeleton around the documented app-layer boundaries.
2. Implement idempotency and proposal persistence.
3. Implement reporting SQL for trial balance, balance sheet, P&L, and general ledger.
4. Implement schedule generation and reconciliation state.
5. Wire agent tool execution and OpenClaw-facing auth/context handling.
6. Add the remaining enforcement paths for closed periods and tenant consistency.
7. Build the internal operator UI on top of the documented APIs.

## Likely Launch Phases

### Phase 1: Internal firm platform
Use the system inside the accounting firm first.
- multi-company support
- approval-gated workflows
- reporting and schedules
- audit and close evidence
- agent assistance for drafting, review, and explanation

### Phase 2: Self-hosted OSS release
Release the platform as a self-hostable OSS project.
- monorepo
- backend, web, workers, and Supabase migrations
- SDK, schemas, domain package, and OpenClaw plugin
- self-host quickstart and OpenClaw quickstart

### Phase 3: Controlled external adoption
Expand to other accounting firms or finance teams once:
- the control model is stable
- reporting and close flows are proven
- OpenClaw integration behavior is predictable
- deployment/hardening guidance is repeatable

### Phase 4: Optional managed offering
Only after the OSS and self-hosted story is stable, consider a managed layer or hosted service.

## Release Shape

The public release model is expected to include:
- a self-hostable monorepo
- npm packages for SDK, schemas, domain logic, and OpenClaw integration
- a documented OpenClaw companion/fork strategy
- deployment and hardening guidance

The project is not being positioned as a single `npm install` accounting product.

## Changelog

### 2026-04-06
- Documented the core architecture, multi-tenant model, ledger engine, reporting model, schedules, storage, auditability, approvals, and API/auth model.
- Added public-facing OSS release docs, including a root README, self-host quickstart, and OpenClaw quickstart.
- Defined the OpenClaw boundary, including companion fork/upstream strategy and Ansible hardening scope.
- Added implementation-facing specs for idempotency, agent proposals, reporting SQL, schedule schema, and agent tool execution.

### Earlier planning phase
- Established the product direction as an accounting control plane for firms.
- Chose Supabase Postgres as the canonical transactional store.
- Chose immutable posted entries with reversal-based corrections.
- Chose OpenClaw as the agent orchestration shell rather than the accounting source of truth.

## Summary

The roadmap is intentionally conservative: document the control plane first, implement the backend second, and only then expand into broader OSS and agent-enabled usage. That keeps the accounting guarantees ahead of the release curve.
