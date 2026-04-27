# Agentic Accounting

Open-source accounting control plane for firms that need multi-company bookkeeping, approval-gated workflows, auditability, reporting, schedules, and agent-assisted operations.

The project is pre-1.0, but it is no longer documentation-only. The current runtime includes a NestJS API, a React operator console, Supabase/Postgres migrations, Docker deployment assets, and Netlify static web deployment config.

## Current Status

Implemented today:

- Supabase-backed authentication and tenant access checks.
- Firm, organization, user, account, period, ledger, approval, audit, proposal, report, and schedule schema foundations.
- Journal draft validation, proposal creation, approval flow, posting, reversal, and audit timeline tools.
- Reports for trial balance, balance sheet, profit and loss, and general ledger.
- Schedule definitions, account selection, ledger-derived schedule generation, run detail review, and variance approval.
- Agent tool schema and execution endpoints for accounting workflows.
- React operator console for dashboard triage, proposals, approvals, entries, reports, schedules, and entity timelines.
- Docker deployment bundles for API-only and operator-console stacks.
- Netlify deployment config for the static operator console.

Still in progress:

- Advanced schedule strategies beyond the current ledger-derived path.
- Worker/background execution.
- Account maintenance UI, close dashboard, settings, and task workflows.
- SDK, schema package, domain package, and OpenClaw plugin packaging.
- One-click bootstrap UX and fuller production runbooks.

## Architecture

This is a modular monorepo, not a microservice split.

```text
apps/
  api/      NestJS API and accounting tool surface
  web/      React operator console
infra/
  supabase/ database migrations and SQL functions
  docker/   API and operator-console deployment bundles
devplan/    product, architecture, and implementation planning docs
```

Planned package directories such as `packages/domain`, `packages/schemas`, `packages/sdk`, and `packages/openclaw-plugin` are documented in `devplan/` and will be added as implementation catches up.

Key design rules:

- The ledger is the source of truth.
- Posted entries are immutable; corrections happen by reversal.
- Every tenant-owned operation is scoped to an organization.
- Human and agent workflows use the same backend controls.
- Approvals, idempotency, and audit events are first-class behavior, not UI-only conventions.

## Requirements

- Node.js 22 or later.
- npm 10 or later.
- A Supabase project, or a self-hosted Supabase/Postgres stack.
- Docker, if using the deployment bundles.

## Install

```bash
npm install
```

Build and test:

```bash
npm run build:api
npm run build:web
npm run test:api
npm run test:web
```

## API Quickstart

1. Copy the API env template:

```bash
cp apps/api/.env.example apps/api/.env
```

2. Fill in:

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Optional local agent credentials are also documented in `apps/api/.env.example`.

3. Apply the Supabase migrations in `infra/supabase/migrations/` to your database.

4. Start the API:

```bash
npm run dev:api
```

5. Check health:

```bash
curl http://localhost:3000/api/v1/health
```

Authenticated tenant-scoped endpoints require a valid Supabase bearer token and an organization ID.

## Minimal Tenant Seed

The API includes a deterministic seed renderer for the smallest usable tenant context:

- one firm
- one app user mapped to a supplied Supabase `auth.users.id`
- one organization
- one firm membership and organization membership
- one open accounting period
- a minimal chart of accounts

Render the seed from the repo root:

```bash
npm run seed:render:minimal --workspace @agentic-accounting/api -- \
  --auth-user-id 11111111-1111-4111-8111-111111111111 \
  --user-email agent@example.com \
  --out infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Use a real Supabase auth user UUID if you want bearer-token flows to work. Generated seed output under `infra/supabase/seeds/generated/` is ignored by Git.

Apply the rendered SQL after migrations:

```bash
psql "$DATABASE_URL" -f infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

## Web Quickstart

1. Copy the web env template:

```bash
cp apps/web/.env.example apps/web/.env
```

2. Set the API base URL:

```text
VITE_DEFAULT_API_BASE_URL=http://localhost:3000
```

3. Start the operator console:

```bash
npm run dev:web
```

4. Open the Vite URL and enter:

- API base URL
- Supabase bearer token
- organization ID
- optional period ID

## API Surface

Representative implemented endpoints:

- `GET /api/v1/health`
- `GET /api/v1/accounts`
- `GET /api/v1/reports/trial-balance`
- `GET /api/v1/reports/balance-sheet`
- `GET /api/v1/reports/profit-and-loss`
- `GET /api/v1/reports/general-ledger`
- `GET /api/v1/schedules/definitions`
- `POST /api/v1/schedules/definitions`
- `GET /api/v1/schedules/runs`
- `GET /api/v1/schedules/runs/:runId`
- `POST /api/v1/schedules/runs`
- `POST /api/v1/schedules/runs/:runId/review`
- `GET /api/v1/agent-tools/schema`
- `GET /api/v1/agent-tools/tool/:toolName`
- `POST /api/v1/agent-tools/execute`
- `POST /api/v1/agent-tools/execute-batch`

## Deployment

API-only Docker deployment:

- `infra/docker/api-only/README.md`

Split API and operator-console Docker deployment:

- `infra/docker/operator-console/README.md`

Netlify static web deployment:

- `apps/web/netlify.toml`

For the hosted Nexius Labs deployment, the production split is:

```text
API: https://api.nexiuslabs.com
Web: https://accounting.nexiuslabs.com
```

Self-hosters should replace those domains with their own and avoid committing real secrets.

## OpenClaw Relationship

OpenClaw is planned as the agent orchestration shell, not the accounting source of truth.

This repository owns the accounting backend, database schema, approval logic, audit trail, operator console, and future plugin/package surface. OpenClaw integration is documented in:

- `devplan/openclaw_integration_01.md`
- `devplan/openclaw_distribution_hardening_01.md`

## Documentation

Start here:

- `devplan/masterPRD.md`
- `devplan/featurePRD_01.md`
- `devplan/architecture_summary_01.md`
- `devplan/api_spec_v1_01.md`
- `devplan/reporting_design_01.md`
- `devplan/schedule_engine_01.md`
- `devplan/bootstrap_ux_01.md`

Release and project docs:

- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `ROADMAP.md`
- `SECURITY.md`
- `LICENSE`

## Security

Do not open public issues for suspected vulnerabilities. See `SECURITY.md` for reporting instructions and supported scope.

## License

This project is licensed under the terms in `LICENSE`.
