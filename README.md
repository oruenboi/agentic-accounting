# Agentic Accounting

Open-source accounting control plane for firms that want multi-company bookkeeping, approval-gated workflows, auditability, reporting, and agent-assisted operations.

This repository is currently documentation- and schema-first. The architecture, storage model, workflow model, and OpenClaw integration approach are defined, but the runtime product is still being implemented.

The first runtime slice now exists in `apps/api`: a NestJS-based backend skeleton with Supabase token verification, Postgres access, health checks, and read-only reporting endpoints.

## Who This Is For

This project is aimed at:
- accounting firms running multiple client companies
- controllership and finance operations teams
- developers building agent-assisted accounting workflows
- teams that want an accounting backend with explicit approvals, audit trails, and tenant isolation

## What The Project Is

The target system is a modular, multi-tenant accounting platform with:
- a NestJS backend API
- a React operator UI
- Supabase as the default supported backend, with Supabase Postgres as the canonical data layer
- Supabase Storage for documents and exports
- a tool-oriented agent interface
- OpenClaw as the orchestration shell for agent workflows

The ledger is the source of truth. Posted accounting records are immutable, and corrections happen by reversal rather than in-place editing.

## Current Maturity

The planning and documentation layer is ahead of the runtime implementation.

Already defined in this repo:
- multi-tenant `firm` / `organization` model
- audit schema and audit read model
- approval model
- ledger schema and posting engine behavior
- reporting and schedule design
- storage and document model
- API auth/client model
- OpenClaw integration and hardening strategy
- packaging/distribution strategy for OSS and npm packages

Already scaffolded in code:
- npm workspace root
- `apps/api` NestJS runtime skeleton
- Supabase-backed auth verification and tenant access checks
- Postgres-backed reporting endpoints for:
  - `GET /api/v1/health`
  - `GET /api/v1/reports/trial-balance`
  - `GET /api/v1/reports/balance-sheet`
  - `GET /api/v1/reports/profit-and-loss`
  - `GET /api/v1/reports/general-ledger`
  - `GET /api/v1/agent-tools/schema`
  - `GET /api/v1/agent-tools/tool/:toolName`
  - `POST /api/v1/agent-tools/execute`
  - `POST /api/v1/agent-tools/execute-batch`

Still to implement:
- broader backend runtime services
- non-user client registry and stronger agent auth beyond the current bounded configured-client path
- schedule runtime and reporting application services
- idempotency and agent proposal runtime workflows
- full write-path orchestration on top of the existing DB constraints

## Architecture Summary

The target shape is a modular monorepo, not microservices.

Core components:
- `apps/api`: accounting backend and tool APIs
- `apps/web`: internal operator UI
- `apps/workers`: background jobs and exports
- `packages/domain`: shared accounting rules
- `packages/schemas`: shared tool and API schemas
- `packages/sdk`: typed client for backend and tools
- `packages/openclaw-plugin`: OpenClaw accounting plugin
- `infra/supabase`: schema, RLS, and SQL objects

Key design principles:
- ledger-centric accounting
- immutable posted entries
- tenant isolation by `organization`
- human and agent flows converge on the same backend
- approvals and audit are first-class constraints

## Repo Structure

```text
apps/
  api/
  web/
  workers/
packages/
  domain/
  schemas/
  sdk/
  openclaw-plugin/
infra/
  supabase/
  docker/
  ansible/
examples/
  api-client/
  openclaw/
devplan/
```

## What Is Implemented Today

This repository currently contains:
- planning and architecture documents
- Supabase migrations for audit, tenant, ledger, and approval foundations
- documentation for reporting, schedules, storage, workflows, audit, and OpenClaw integration
- a first NestJS API skeleton in `apps/api`

The implemented database foundations include:
- `audit_logs`
- `approval_actions`
- `firms`
- `organizations`
- `journal_entries`
- `journal_entry_lines`
- `journal_entry_drafts`
- `accounting_periods`
- `approval_requests`
- guard logic for period overlap, immutability, and balanced posting

## What Is Planned

The remaining product work is mainly:
- backend service implementation
- agent tool execution and auth enforcement
- reporting SQL views
- schedule generation and reconciliation runtime
- public package publishing
- self-hosted deployment automation
- OpenClaw host hardening and integration rollout

## OpenClaw Relationship

OpenClaw is the orchestration shell for agent interaction, not the accounting source of truth.

The intended split is:
- this repo owns the accounting backend, schemas, docs, and plugin package
- OpenClaw provides the agent host and orchestration layer
- production OpenClaw support may require a companion fork or upstreamed host changes
- durable approval, posting, tenant enforcement, and audit remain in the accounting backend

OpenClaw integration and hardening are documented separately in:
- `devplan/openclaw_integration_01.md`
- `devplan/openclaw_distribution_hardening_01.md`

## Self-Hosting Posture

This project is intended to be self-hostable.

Supabase is the default and supported backend for OSS deployments. The expected setup paths are:
- connect the platform to a hosted Supabase project for the fastest start
- self-host Supabase if you want full infrastructure control

Plain Postgres without the Supabase layer is not the primary target.

The public distribution model is:
- a monorepo that can be cloned and deployed
- installable npm packages for SDK, schemas, and plugin integration
- Supabase migrations, RLS, auth assumptions, and storage model for the canonical data layer
- optional Ansible hardening for production deployments

The recommended release shape is:
- platform mode for operators and self-hosters
- package mode for developers integrating the SDK or OpenClaw plugin

## Key Documentation

Start with these docs:
- `devplan/masterPRD.md`
- `devplan/featurePRD_01.md`
- `devplan/architecture_summary_01.md`
- `devplan/api_spec_v1_01.md`
- `devplan/openclaw_integration_01.md`
- `devplan/documentation_inventory_01.md`

Useful implementation-facing docs:
- `devplan/ledger_posting_engine_01.md`
- `devplan/reporting_design_01.md`
- `devplan/schedule_engine_01.md`
- `devplan/storage_blueprint_01.md`
- `devplan/workflow_close_01.md`
- `devplan/audit_read_model_01.md`
- `devplan/api_auth_client_model_01.md`
- `devplan/packaging_distribution_01.md`
- `devplan/openclaw_distribution_hardening_01.md`

## How To Get Started

This repo is not yet a complete runnable product, so the right first step is to read the design docs in order:

1. `devplan/masterPRD.md`
2. `devplan/featurePRD_01.md`
3. `devplan/architecture_summary_01.md`
4. `devplan/api_spec_v1_01.md`
5. `devplan/openclaw_integration_01.md`
6. `devplan/documentation_inventory_01.md`

If you are here to implement the system, the next practical build order is:
1. backend runtime
2. agent tool execution/auth layer
3. reporting SQL
4. schedule runtime
5. OpenClaw plugin and host integration

## Local API Quickstart

1. Copy [apps/api/.env.example](C:\Users\wdqia\Nexius Labs\Nexius Dev Team - Darryl Dev\agentic-accounting\apps\api\.env.example) to `apps/api/.env` and fill in:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. Run `npm install`
3. Run `npm run dev:api`
4. Call:
   - `GET /api/v1/health`
   - `GET /api/v1/reports/*` with a valid Supabase bearer token
   - `GET /api/v1/agent-tools/schema` with either:
     - a valid Supabase bearer token
     - or configured agent headers:
       - `x-agent-client-id`
       - `x-agent-client-secret`

For tenant-scoped `agent-tools` report reads with agent credentials, also send:
- `x-delegated-auth-user-id`

## Status Notes

The documentation inventory is intentionally kept up to date in `devplan/`. When the implementation catches up, the repo can move from planning-first to runtime-first without changing the architecture.
