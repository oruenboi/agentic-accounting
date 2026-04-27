# Agentic Accounting Roadmap

This project is moving from a documentation-complete foundation into early runtime implementation. The architecture, control model, OpenClaw integration approach, and release shape are documented; the first API and operator-console slices now exist.

## Current Phase

The current phase is:
- documentation and planning complete for the core architecture
- schema and control model largely specified
- first backend and operator-console workflow slices implemented
- implementation work still pending for workers, schedules, broader UI coverage, OpenClaw plugin packaging, and operational automation
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

## What Has Shipped In The First Runtime Slice

The first runtime slice now includes:
- NestJS API foundation with Supabase-backed auth and tenant checks
- reporting endpoints for trial balance, balance sheet, profit and loss, and general ledger
- agent-tool schema and execution endpoints
- journal draft, proposal, approval, posting, reversal, audit-event, and timeline tools
- deterministic minimal tenant seed rendering
- React operator console for dashboard triage, proposals, approvals, posted entries, and audit timelines
- React operator console report views for trial balance, balance sheet, profit and loss, and general ledger
- read-only schedule run API and operator console review screens for persisted balance sheet support schedules
- API-only VPS deployment assets, operator-console VPS deployment assets, and Netlify static web deployment config

## What Is Still Implementation-Pending

The main implementation gaps are:
- schedule schema and generation runtime
- worker/background execution
- broader operator UI for close, settings, and tasks
- OpenClaw plugin package and host integration
- one-click bootstrap UX for database, storage, env templates, API, web, workers, and optional OpenClaw setup
- production hardening and operational runbooks

Some lower-level foundations for these areas already exist, but the end-to-end product workflows are not complete.

## Near-Term Milestones

1. Expand operator UI coverage for close, settings, and tasks.
2. Implement schedule generation and reconciliation runtime beyond the current read-only schedule review surface.
3. Add worker/background execution for exports, schedules, close support, and maintenance jobs.
4. Package the SDK, schemas, domain helpers, and OpenClaw plugin.
5. Implement the planned one-click bootstrap UX.
6. Harden production deployment, backup, observability, and runbook guidance.
7. Prove the OpenClaw integration against a pinned host strategy.

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
- an OpenClaw plugin package, plus a documented companion-fork/upstream host strategy rather than a vendored OpenClaw host
- deployment and hardening guidance

The project is not being positioned as a single `npm install` accounting product.

## Changelog

### 2026-04-06
- Documented the core architecture, multi-tenant model, ledger engine, reporting model, schedules, storage, auditability, approvals, and API/auth model.
- Added public-facing OSS release docs, including a root README, self-host quickstart, and OpenClaw quickstart.
- Defined the OpenClaw boundary, including companion fork/upstream strategy and Ansible hardening scope.
- Added implementation-facing specs for idempotency, agent proposals, reporting SQL, schedule schema, and agent tool execution.

### 2026-04-23
- Added the first API runtime slice for reporting, journal draft/proposal workflow, approvals, posting, reversals, audit reads, and agent-tool execution.
- Added the first React operator console for dashboard triage, proposals, approvals, posted entries, and audit timelines.
- Added API-only, split-domain operator-console, and Netlify deployment paths for the current runtime slices.

### Earlier planning phase
- Established the product direction as an accounting control plane for firms.
- Chose Supabase Postgres as the canonical transactional store.
- Chose immutable posted entries with reversal-based corrections.
- Chose OpenClaw as the agent orchestration shell rather than the accounting source of truth.

## Summary

The roadmap is intentionally conservative: document the control plane first, implement the backend second, and only then expand into broader OSS and agent-enabled usage. That keeps the accounting guarantees ahead of the release curve.
