# Operator Console VPS Deployment

This directory extends the API deployment to include the first operator console UI.

## Scope

- deploy `apps/api` behind `api.nexiuslabs.com`
- deploy `apps/web` behind `accounting.nexiuslabs.com`
- terminate TLS with one Caddy instance on the VPS
- keep the console static and point it at the API with a build-time default URL

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
/home/darryl/agentic-accounting
```

If you keep the repo elsewhere, update the Compose build contexts accordingly.

## Files

- `.env`
  - stack-level settings
  - expected keys:
    - `API_DOMAIN`
    - `WEB_DOMAIN`
    - `TLS_EMAIL`
    - `WEB_DEFAULT_API_BASE_URL`
    - `SOURCE_ROOT` (absolute path to the Git checkout in production)
    - `APP_VERSION` (release tag, normally the short Git SHA)
    - `APP_REVISION` (full Git commit SHA)
- `api.env`
  - runtime settings for `apps/api`
  - expected keys:
    - `PORT`
    - `DATABASE_URL`
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`

## Domain and HTTPS

- point `API_DOMAIN` and `WEB_DOMAIN` at the VPS public IPv4 address with `A` records
- open inbound `80/tcp` and `443/tcp`
- Caddy will obtain and renew Let’s Encrypt certificates automatically

Recommended production values:

```text
API_DOMAIN=api.nexiuslabs.com
WEB_DOMAIN=accounting.nexiuslabs.com
WEB_DEFAULT_API_BASE_URL=https://api.nexiuslabs.com
TLS_EMAIL=agent@nexiuslabs.com
```

## First Deploy

1. Copy `compose.yaml`, `Caddyfile`, `.env.example`, and `api.env.example` into `/srv/agentic-accounting/`.
2. Rename `.env.example` to `.env`.
3. Rename `api.env.example` to `api.env`.
4. Fill in real values.
5. Set `SOURCE_ROOT` to the checked-out repository path.
6. Set `APP_VERSION` and `APP_REVISION` from the commit being released.
7. Run `docker compose build --pull api web` from `/srv/agentic-accounting/`.
8. Verify both image revision labels, then run `docker compose up -d --no-build`.

Docker builds use the repository root `package-lock.json` with `npm ci`. Base images are pinned by digest, and application images are tagged and labeled with the release revision.

## Smoke Checks

- `https://api.nexiuslabs.com/api/v1/health`
- `https://accounting.nexiuslabs.com`
- `https://accounting.nexiuslabs.com/dashboard`

The web app is a static operator console. Operators still need a valid bearer token and organization context to use the current alpha session bootstrap.

## Rollback

Set `APP_VERSION` and `APP_REVISION` to the previous deployed revision and run `docker compose up -d --no-build`. Retain at least the current and previous application images until smoke checks pass.
