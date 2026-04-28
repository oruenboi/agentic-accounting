# Testing Infrastructure

This directory contains disposable infrastructure for integration smoke tests. It must not read production environment files or connect to production databases.

## Disposable Postgres Smoke Test

Start the local test database:

```bash
docker compose -f infra/testing/postgres/compose.yaml up -d
```

Run the migration, guard, and RLS smoke suite:

```bash
npm run test:db
```

Stop the test database:

```bash
docker compose -f infra/testing/postgres/compose.yaml down -v
```

The default test URL is:

```text
postgres://postgres:postgres@127.0.0.1:55432/agentic_accounting_test
```

The smoke runner refuses to run unless the target database URL points to `localhost` or `127.0.0.1`, uses port `55432`, and has `test` in the database name.

## Authenticated API Smoke Test

Run read-only authenticated checks against a running API:

```bash
API_BASE_URL=https://api.example.com \
TOKEN=eyJ... \
ORG_ID=00000000-0000-4000-8000-000000000000 \
npm run smoke:auth
```

The runner calls only GET endpoints:

- `/api/v1/health`
- `/api/v1/accounts`
- `/api/v1/close/overview`
- `/api/v1/schedules/definitions`
- `/api/v1/schedules/runs`
- `/api/v1/reports/trial-balance`
- `/api/v1/reports/balance-sheet`
- `/api/v1/reports/profit-and-loss`
- `/api/v1/reports/general-ledger`

Optional environment variables:

- `BEARER_TOKEN` or `SUPABASE_ACCESS_TOKEN`: accepted aliases for `TOKEN`.
- `ORGANIZATION_ID`: accepted alias for `ORG_ID`.
- `SMOKE_AS_OF_DATE`: report and close date, defaults to today's UTC date.
- `SMOKE_FROM_DATE`: report start date, defaults to the first day of `SMOKE_AS_OF_DATE`'s month.
- `SMOKE_TIMEOUT_MS`: per-request timeout in milliseconds, defaults to `15000`.

The runner prints endpoint names and HTTP status only. Do not commit real tokens or organization-specific secrets.
