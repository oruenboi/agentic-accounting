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
5. Run `docker compose up -d --build` from `/srv/agentic-accounting/`.

## Smoke Checks

- `https://API_DOMAIN/api/v1/health`
- `https://API_DOMAIN/api/v1/reports/trial-balance`
- `https://API_DOMAIN/api/v1/reports/balance-sheet`
- `https://API_DOMAIN/api/v1/reports/profit-and-loss`
- `https://API_DOMAIN/api/v1/reports/general-ledger`

The report endpoints still require a valid Supabase bearer token and tenant membership in the database.

## Current Blockers Outside This Config

- the repo checkout currently has no top-level `AGENTS.md`
- the copied checkout does not include `.git` metadata
- production values are still needed for:
  - `API_DOMAIN`
  - `TLS_EMAIL`
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
