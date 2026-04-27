# Agentic Accounting

Open-source accounting control plane for firms that want multi-company bookkeeping, approval-gated workflows, auditability, reporting, and agent-assisted operations.

This repository is currently documentation- and schema-first. The architecture, storage model, workflow model, and OpenClaw integration approach are defined, but the runtime product is still being implemented.

The first runtime slices now exist in:
- `apps/api`: a NestJS-based backend with workflow, approval, posting, reversal, audit, and reporting tools
- `apps/web`: a React operator console for proposals, approvals, posted entries, and audit review

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
- `apps/web` React operator console scaffold
- Supabase-backed auth verification and tenant access checks
- deterministic minimal tenant bootstrap seed rendering for first usable firm/org/user/account data
- proposal-style journal draft creation with idempotency replay/conflict handling and linked `agent_proposals`
- operator UI routes for:
  - dashboard triage
  - proposal queue and detail
  - approval queue and detail
  - posted journal entry list and detail
  - trial balance, balance sheet, profit and loss, and general ledger reports
  - schedule run list and detail review
  - entity timeline review
- Postgres-backed reporting endpoints for:
  - `GET /api/v1/health`
  - `GET /api/v1/reports/trial-balance`
  - `GET /api/v1/reports/balance-sheet`
  - `GET /api/v1/reports/profit-and-loss`
  - `GET /api/v1/reports/general-ledger`
  - `GET /api/v1/schedules/runs`
  - `GET /api/v1/schedules/runs/:runId`
  - `GET /api/v1/agent-tools/schema`
  - `GET /api/v1/agent-tools/tool/:toolName`
  - `POST /api/v1/agent-tools/execute`
  - `POST /api/v1/agent-tools/execute-batch`

Still to implement:
- non-user client registry and stronger agent auth beyond the current bounded configured-client path
- schedule generation runtime and broader schedule workflow services
- broader operator UI coverage for reports, schedules, close, settings, and tasks
- fuller audit/event surfacing and operational hardening around the current workflow engine

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
- a first NestJS API in `apps/api` with health, reporting, journal workflow, approval, posting, reversal, audit, and agent-tool execution paths
- a first React operator console in `apps/web`
- Docker and Netlify deployment paths for the current API and web slices

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
- `idempotency_keys`
- `agent_proposals`
- reporting SQL views
- schedule-related schema foundations

## What Is Planned

The remaining product work is mainly:
- broader operator UI implementation
- reporting and schedule runtime expansion
- richer audit and policy surfaces
- public package publishing
- self-hosted deployment automation
- OpenClaw host hardening and integration rollout

## OpenClaw Relationship

OpenClaw is the orchestration shell for agent interaction, not the accounting source of truth.

The intended split is:
- this repo owns the accounting backend, schemas, docs, and plugin package
- OpenClaw provides the agent host and orchestration layer
- the initial OSS release will not vendor the OpenClaw host into this repo
- production OpenClaw support should use a documented companion fork or upstreamed host changes once a compatible host target is validated
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
- `devplan/bootstrap_ux_01.md`

Release and contribution docs:
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `SECURITY.md`
- `ROADMAP.md`

## How To Get Started

This repo is not yet a complete runnable product, so the right first step is to read the design docs in order:

1. `devplan/masterPRD.md`
2. `devplan/featurePRD_01.md`
3. `devplan/architecture_summary_01.md`
4. `devplan/api_spec_v1_01.md`
5. `devplan/openclaw_integration_01.md`
6. `devplan/documentation_inventory_01.md`

If you are here to implement the system, the next practical build order is:
1. operator UI expansion
2. reporting and schedule runtime
3. worker/background execution
4. bootstrap and deployment automation
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

The current `agent-tools` write-oriented surface now includes:
- `validate_journal_entry`
- `create_journal_entry_draft`

`create_journal_entry_draft` currently:
- validates the requested journal before persisting
- writes `journal_entry_drafts` and `journal_entry_draft_lines`
- writes a linked `agent_proposals` row
- performs a first application-layer idempotency replay/conflict check against `idempotency_keys`

## Minimal Tenant Bootstrap

The API now includes a deterministic seed renderer for the smallest usable tenant context:
- one firm
- one app user mapped to a supplied `auth_user_id`
- one organization
- one firm membership and one organization membership
- one open accounting period
- a minimal chart of accounts

Render the SQL from the repo root:

```powershell
npm run seed:render:minimal --workspace @agentic-accounting/api -- `
  --auth-user-id 11111111-1111-4111-8111-111111111111 `
  --user-email agent@nexiuslabs.com `
  --out infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Important:
- use a real Supabase `auth.users.id` UUID if you want bearer-token flows to work for the seeded user
- the generated SQL is idempotent and safe to re-apply
- generated seed output under `infra/supabase/seeds/generated/` is ignored by Git

Apply the rendered SQL after migrations:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Once applied, the live API can satisfy tenant-scoped report reads and `validate_journal_entry` calls instead of failing on empty tenant data.

## Local Web Quickstart

The first operator console lives in [apps/web](C:\Users\wdqia\Nexius%20Labs%20\Nexius%20Dev%20Team%20-%20Darryl%20Dev\agentic-accounting\apps\web).

1. Run `npm install`
2. Run `npm run dev:web`
3. Open the Vite URL shown in the terminal
4. Paste:
   - API base URL, for example `https://api.nexiuslabs.com`
   - a valid Supabase bearer token
   - an organization ID
   - optionally a period ID

The current console supports:
- dashboard triage cards
- proposal queue and proposal detail with linked draft inspection
- approval queue and approval detail with approve, reject, and escalate controls
- posted journal entry list/detail
- reports for trial balance, balance sheet, profit and loss, and general ledger
- schedule run list/detail review for persisted balance sheet support schedules
- entity audit timeline review

The session bootstrap will prefill the API base URL from `VITE_DEFAULT_API_BASE_URL` when present. For the intended production deployment, use:

```text
VITE_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
```

## Operator Console VPS Deploy

The split-domain production target is:

```text
https://api.nexiuslabs.com
https://accounting.nexiuslabs.com
```

Use the production stack under [infra/docker/operator-console](C:\Users\wdqia\Nexius%20Labs%20\Nexius%20Dev%20Team%20-%20Darryl%20Dev\agentic-accounting\infra\docker\operator-console) to deploy both services behind one Caddy instance.

Recommended values:

```text
API_DOMAIN=api.nexiuslabs.com
WEB_DOMAIN=accounting.nexiuslabs.com
WEB_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
TLS_EMAIL=agent@nexiuslabs.com
```

## Operator Console Netlify Deploy

`apps/web` can also be deployed separately on Netlify while keeping the API on the VPS.

- Netlify config lives at [apps/web/netlify.toml](C:\Users\wdqia\Nexius%20Labs%20\Nexius%20Dev%20Team%20-%20Darryl%20Dev\agentic-accounting\apps\web\netlify.toml)
- publish target: `dist`
- build command: `npm install && npm run build`

Recommended production environment variable:

```text
VITE_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
```

## Status Notes

The documentation inventory is intentionally kept up to date in `devplan/`. When the implementation catches up, the repo can move from planning-first to runtime-first without changing the architecture.
