# Deployment Runbook

This runbook describes the current production-capable deployment path for Agentic Accounting. It is written for self-hosters and operators, so all domains, tokens, and tenant identifiers are placeholders.

## Topology

The current supported deployment shape is:

- NestJS API in `apps/api`
- React operator console in `apps/web`
- Supabase/Postgres for auth, tenant data, RLS, ledger tables, reports, and schedules
- Docker Compose and Caddy for VPS API hosting
- Netlify or static hosting for the operator console

Two Docker bundles are provided:

- `infra/docker/api-only/`: API behind Caddy
- `infra/docker/operator-console/`: API and static web behind Caddy

The operator console can also be deployed separately to Netlify while the API remains on a VPS.

## Prerequisites

- Node.js 22 or later
- npm 10 or later
- Docker and Docker Compose for VPS deployment
- A Supabase project or self-hosted Supabase stack
- A public API domain, for example `api.example.com`
- A public web domain, for example `accounting.example.com`
- A Supabase access token for a user that belongs to the smoke-test organization

Do not commit real values for `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, bearer tokens, or organization IDs.

## Build And Test Before Deploy

Run these from the repository root:

```bash
npm install
npm run build:api
npm run build:web
npm run test:api
npm run test:web
```

For database migration and RLS checks, use the disposable test database harness:

```bash
docker compose -f infra/testing/postgres/compose.yaml up -d
npm run test:db
docker compose -f infra/testing/postgres/compose.yaml down -v
```

The DB harness refuses production-looking database URLs and is documented in `infra/testing/README.md`.

## Database Migrations

Apply every migration in lexical order from:

```text
infra/supabase/migrations/
```

Operational rules:

- Apply required migrations before deploying an API build that depends on them.
- Do not point migration smoke tests at production.
- Back up production Postgres before manual migration work.
- Verify `/api/v1/health` after migration; the response should report database status as ok.

## Tenant Bootstrap

For a new environment, render a minimal tenant seed:

```bash
npm run seed:render:minimal --workspace @agentic-accounting/api -- \
  --auth-user-id 11111111-1111-4111-8111-111111111111 \
  --user-email operator@example.com \
  --out infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Use a real Supabase `auth.users.id` value if you need bearer-token API access for that user.

Apply the rendered seed after migrations:

```bash
psql "$DATABASE_URL" -f infra/supabase/seeds/generated/minimal_tenant_bootstrap.sql
```

Generated seed files under `infra/supabase/seeds/generated/` are intentionally ignored by Git.

## VPS API Deployment

Use this layout on the VPS:

```text
/srv/agentic-accounting/
  compose.yaml
  Caddyfile
  .env
  api.env
```

Keep a source checkout separately, for example:

```text
/srv/agentic-accounting-repo/
```

Copy the runtime bundle:

```bash
cp infra/docker/api-only/compose.yaml /srv/agentic-accounting/compose.yaml
cp infra/docker/api-only/Caddyfile /srv/agentic-accounting/Caddyfile
cp infra/docker/api-only/.env.example /srv/agentic-accounting/.env
cp infra/docker/api-only/api.env.example /srv/agentic-accounting/api.env
```

Set stack-level values in `/srv/agentic-accounting/.env`:

```text
API_DOMAIN=api.example.com
TLS_EMAIL=ops@example.com
```

Set API runtime values in `/srv/agentic-accounting/api.env`:

```text
PORT=3000
DATABASE_URL=postgres://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
```

Start or update the stack:

```bash
cd /srv/agentic-accounting
docker compose up -d --build
```

Verify:

```bash
curl -I https://api.example.com/api/v1/health
```

## Operator Console On Netlify

From the web app directory:

```bash
cd apps/web
npx netlify-cli login
npx netlify-cli init --manual
npx netlify-cli env:set VITE_DEFAULT_API_BASE_URL "https://api.example.com" --context production
npm run build
npx netlify-cli deploy --prod --dir="$(pwd)/dist"
```

The Vite SPA fallback is committed in `apps/web/public/_redirects`, and production builds should include `dist/_redirects`.

Verify:

```bash
curl -I https://accounting.example.com
curl -I https://accounting.example.com/dashboard
curl -I https://accounting.example.com/close
```

Add the custom web domain in Netlify, then follow Netlify's DNS instructions for the domain record. The API domain should continue to point at the VPS unless you intentionally move the API.

## Post-Deploy Smoke

Run the read-only authenticated smoke suite after API and web deploys:

```bash
API_BASE_URL=https://api.example.com \
TOKEN="$TOKEN" \
ORG_ID="$ORG_ID" \
npm run smoke:auth
```

The runner also accepts:

- `BEARER_TOKEN` or `SUPABASE_ACCESS_TOKEN`
- `ORGANIZATION_ID`

It checks health, accounts, close overview, schedule reads, and reports. It does not mutate accounting data.

## Upgrade Procedure

For a routine release:

1. Pull the repository.
2. Review pending migrations.
3. Back up production database state.
4. Apply new migrations if present.
5. Rebuild and restart the API.
6. Build and deploy the operator console.
7. Run health and authenticated smoke checks.
8. Record the before and after Git SHAs.

Example VPS sequence:

```bash
cd /srv/agentic-accounting-repo
git rev-parse --short HEAD
git pull --ff-only origin master
git rev-parse --short HEAD

cd /srv/agentic-accounting
docker compose up -d --build api
curl -I https://api.example.com/api/v1/health
```

Then deploy the web bundle from the checkout and run `npm run smoke:auth`.

## Rollback Notes

- Keep timestamped copies of `/srv/agentic-accounting/compose.yaml`, `Caddyfile`, `.env`, and `api.env` before runtime changes.
- Do not roll back code across already-applied irreversible database migrations without a tested database rollback plan.
- For Netlify, use the previous production deploy in the Netlify UI or CLI if only the web bundle needs rollback.
- For API runtime failures without migration conflicts, redeploy the previous Git SHA and rebuild the API container.

## Production Safety

- Never print bearer tokens or database URLs in deploy logs.
- Never replace `api.env` with example values over a live environment.
- Keep Supabase/Postgres ports private unless explicitly required.
- Prefer read-only smoke checks against production.
- Run mutation smoke checks only against disposable or explicitly designated test tenants.
