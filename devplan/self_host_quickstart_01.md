---
owner: Codex
status: in_progress
last_reviewed: 2026-04-07
---

# Self-Host Quickstart 01

## Purpose
This quickstart describes how the planned accounting platform should be launched in a self-hosted environment. It is intentionally release-facing and reflects the documented architecture, not a finished implementation.

Supabase is the default supported backend for this project. The recommended setup paths are:
- hosted Supabase for the fastest OSS evaluation and deployment path
- self-hosted Supabase for teams that want full infrastructure control

Plain Postgres without the Supabase layer is not the primary support target.

## What You Get
The self-hosted platform is planned as a monorepo with:
- `apps/api` for the backend
- `apps/web` for the internal UI
- `apps/workers` for background jobs
- `infra/supabase` for schema, RLS, and SQL objects
- `packages/sdk`, `packages/schemas`, `packages/domain`, and `packages/openclaw-plugin` for reusable integration pieces

## Prerequisites
Before deployment, expect to have:
- Node.js and a package manager for the monorepo
- a Supabase project or self-hosted Supabase stack
- Supabase Postgres for accounting data
- Supabase Storage for attachments and exports
- Supabase Auth for user sessions and JWT validation
- access to the planned environment variables and secrets
- a deployment target for API, web, and worker processes

Optional but recommended:
- Docker or compose for local and small-scale self-hosting
- a reverse proxy or ingress layer
- a backup target for database and storage artifacts

## Expected Repo Layout
The public distribution is planned around this structure:

```text
agentic-accounting/
  apps/
    api/
    web/
    workers/
  packages/
    sdk/
    schemas/
    domain/
    openclaw-plugin/
    config/
  infra/
    supabase/
    docker/
    ansible/
  examples/
    api-client/
    openclaw/
  devplan/
```

## Environment Categories
The platform should be configured by environment category, not by ad hoc local state.

### Core categories
- `NODE_ENV` or equivalent runtime mode
- database connection settings
- storage settings
- auth settings
- API base URLs
- worker runtime settings
- observability settings
- OpenClaw integration settings if used

### Typical secrets and config groups
- database credentials
- auth/JWT verification settings
- storage access keys
- backend service tokens
- agent client tokens
- external integration credentials
- logging/monitoring endpoints

The same categories should exist across local, development, staging, and production, even if the actual values differ.

## Bootstrap Order
The intended bootstrap order is:

1. Install dependencies
2. Provision infrastructure
3. Apply database migrations
4. Create or verify tenant bootstrap data
5. Configure storage buckets and access policies
6. Configure environment variables and secrets
7. Start the API service
8. Start the worker service
9. Start the web application
10. Verify read-only and workflow paths

The order matters because the backend is the source of truth and the UI depends on the API, not the other way around.

### Current backend bootstrap path
The repo now includes a first runtime slice in `apps/api`.

Current local sequence:
1. copy `apps/api/.env.example` to `apps/api/.env`
2. fill in `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`
3. run `npm install` at the repo root
4. run `npm run dev:api`
5. verify:
   - `GET /api/v1/health`
   - `GET /api/v1/reports/trial-balance`
   - `GET /api/v1/reports/balance-sheet`
   - `GET /api/v1/reports/profit-and-loss`
   - `GET /api/v1/reports/general-ledger`

The report endpoints require a valid Supabase bearer token and organization access in the database.

### Current tenant bootstrap path
After migrations, render a deterministic minimal tenant seed before testing tenant-scoped tools:

```powershell
npm run seed:render:minimal --workspace @agentic-accounting/api -- `
  --auth-user-id 11111111-1111-4111-8111-111111111111 `
  --user-email agent@nexiuslabs.com `
  --out infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Then apply it to the target database:

```bash
PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

What this bootstrap creates:
- one active firm
- one active app user mapped to the supplied `auth_user_id`
- one active firm membership
- one active organization
- one active organization membership
- one open accounting period
- a minimal chart of accounts suitable for report reads and `validate_journal_entry`

Operational note:
- use a real Supabase `auth.users.id` UUID if you want bearer-token flows for that user
- generated seed output is ignored by Git and can be re-rendered safely
- the SQL is idempotent and can be re-applied after environment rebuilds

### Current minimal VPS production path
For the first production deployment, keep the footprint to the accounting API only:
- build and run `apps/api` in Docker
- terminate TLS and reverse proxy with Caddy
- use managed Supabase for Postgres and Auth
- keep any OpenClaw or plugin host deployment on separate infrastructure

Current deployment assets live in `infra/docker/api-only/` and expect:
- one public API domain
- inbound `80/tcp` and `443/tcp`
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- Caddy environment for `API_DOMAIN` and `TLS_EMAIL`

## Database And Migration Flow
The current design expects:
- canonical accounting data in Supabase Postgres
- schema changes applied through migrations
- RLS enabled on tenant-owned tables
- SQL views and functions used for reporting
- auth and storage behavior aligned with Supabase

Recommended order:
1. initialize database
2. apply tenant and audit migrations
3. apply ledger and approval migrations
4. apply reporting and schedule-related objects once implemented
5. verify read policies and helper functions

Operational rule:
- never deploy the application before the migrations required by that release are in place
- never treat an empty tenant database as a runtime bug until the bootstrap seed has been rendered and applied

## Service Startup Flow

### API
The API service should:
- load environment and secrets
- connect to Postgres
- verify auth configuration
- expose REST-style application endpoints and agent tool endpoints
- fail fast if critical configuration is missing

### Workers
The worker service should:
- load the same tenant-safe configuration
- connect to Postgres and storage
- pick up background jobs such as exports, schedule generation, and close support tasks
- fail fast if it cannot access the job store or storage target

### Web
The web application should:
- load public runtime config
- point at the API base URL
- use the same authentication and tenant context model as the backend expects

## Storage Setup
The platform should use object storage for:
- source documents
- working papers
- report exports
- audit artifacts

Expected buckets:
- `client-documents`
- `bank-statements`
- `working-papers`
- `report-exports`
- `audit-artifacts`

Self-hosting requires:
- bucket creation
- permission policies
- path conventions that include firm and organization context
- backup or retention planning for important exports and evidence files

For OSS, these buckets and policies should be created in Supabase Storage as part of the supported setup path.

## OpenClaw Optionality
OpenClaw integration is optional for basic self-hosting and expected for agent-enabled use.

### Without OpenClaw
You can still self-host:
- accounting backend
- UI
- worker processes
- database and storage

This supports human-driven workflows, approvals, reporting, and close operations.

### With OpenClaw
You should additionally configure:
- the accounting OpenClaw plugin
- the required OpenClaw host version or companion fork
- the hardened OpenClaw deployment path
- agent client credentials and tenant binding

OpenClaw is a host and orchestration layer, not the accounting source of truth.

## Current Limitations
This quickstart reflects the planned platform, not a finished release.

Limitations to expect:
- implementation work is still pending for most backend features beyond the initial read-only API
- the repo currently documents many behaviors before the code exists
- the exact full-platform startup commands and infrastructure scripts are not finalized
- OpenClaw host changes may live in a companion fork or upstream branch
- production hardening details will depend on the final deployment topology

## Recommended First Self-Host Use
For the first self-hosted deployment, keep the scope narrow:
- one firm
- one or a few client organizations
- human-driven workflows first
- approval-gated mutations only
- no autonomous agent posting

That allows the platform to validate:
- tenant isolation
- posting integrity
- reporting
- approvals
- audit trail quality

## What To Verify Before Expanding
Before broader rollout, verify:
- ledger posting rules work correctly
- audit trails are readable
- approvals are enforced
- backup and restore are proven
- schedule/report outputs match posted ledger data
- OpenClaw integration is constrained and auditable if enabled

## Non-Goals For This Quickstart
- full production deployment automation
- final Ansible playbooks
- final Docker compose definitions
- guaranteed one-command bootstrap
- autonomous agent posting

## Related Documentation
- [packaging_distribution_01.md](./packaging_distribution_01.md)
- [supabase_install_options_01.md](./supabase_install_options_01.md)
- [openclaw_distribution_hardening_01.md](./openclaw_distribution_hardening_01.md)
- [operational_setup_01.md](./operational_setup_01.md)
- [api_auth_client_model_01.md](./api_auth_client_model_01.md)
