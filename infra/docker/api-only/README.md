# API-Only VPS Deployment

This directory contains the minimal first production deployment for the accounting plane API.

## Scope

- deploy `apps/api` only
- use managed Supabase for Postgres/Auth
- run the API behind Caddy on a single Ubuntu VPS
- keep the OpenClaw/plugin host separate from this stack

## Recommended VPS Layout

```text
/srv/agentic-accounting/
  compose.yaml
  .env
  api.env
  Caddyfile
```

Recommended source checkout location:

```text
/srv/agentic-accounting-repo/
```

If you keep the repo elsewhere, update the Compose build context accordingly.

## Files

- `.env`
  - stack-level settings for the reverse proxy
  - expected keys:
    - `API_DOMAIN`
    - `TLS_EMAIL`
    - `SOURCE_ROOT` (absolute path to the Git checkout in production)
    - `APP_VERSION` (release tag, normally the short Git SHA)
    - `APP_REVISION` (full Git commit SHA)
- `api.env`
  - application runtime settings for `apps/api`
  - expected keys:
    - `PORT`
    - `DATABASE_URL`
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`

## Domain and HTTPS

- point `API_DOMAIN` at the VPS public IPv4 address with an `A` record
- open inbound `80/tcp` and `443/tcp`
- Caddy will obtain and renew Let’s Encrypt certificates automatically

## First Deploy

1. Copy `compose.yaml`, `Caddyfile`, `.env.example`, and `api.env.example` into `/srv/agentic-accounting/`.
2. Rename `.env.example` to `.env`.
3. Rename `api.env.example` to `api.env`.
4. Fill in real values.
5. Set `SOURCE_ROOT` to the checked-out repository path.
6. Set `APP_VERSION` and `APP_REVISION` from the commit being released.
7. Run `docker compose build --pull api` from `/srv/agentic-accounting/`.
8. Verify the image revision label, then run `docker compose up -d --no-build`.

Docker builds use the repository root `package-lock.json` with `npm ci`. Base images are pinned by digest, and the resulting application image is tagged and labeled with the release revision.

## Smoke Checks

- `https://API_DOMAIN/api/v1/health`
- `https://API_DOMAIN/api/v1/reports/trial-balance`
- `https://API_DOMAIN/api/v1/reports/balance-sheet`
- `https://API_DOMAIN/api/v1/reports/profit-and-loss`
- `https://API_DOMAIN/api/v1/reports/general-ledger`

The report endpoints still require a valid Supabase bearer token and tenant membership in the database.

## Rollback

Set `APP_VERSION` and `APP_REVISION` to the previous deployed revision and run `docker compose up -d --no-build`. Retain at least the current and previous application images until smoke checks pass.
