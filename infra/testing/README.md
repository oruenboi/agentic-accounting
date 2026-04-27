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
