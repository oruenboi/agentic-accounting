---
owner: Codex
status: in_progress
last_reviewed: 2026-04-26
---

# Bootstrap UX 01

## Purpose
Define the first one-click bootstrap experience for Agentic Accounting across database, storage, environment templates, API, web, workers, and optional OpenClaw setup.

This is a UX and implementation plan, not a finished automation script.

## Target User
The first bootstrap flow is for a technical operator who can provide:

- a Supabase project or self-hosted Supabase connection
- a Supabase `auth.users.id` for the first operator
- deployment domains for API and web if deploying beyond local
- secrets and environment values
- optional OpenClaw host details

It is not yet for non-technical self-service setup.

## Bootstrap Modes

### Local evaluation
Goal:
- get API, web, migrations, and seed data running locally or against a hosted Supabase project

Expected command shape:

```bash
npm run bootstrap:local
```

This mode should:
- verify Node and npm versions
- verify required environment files or offer to generate them from examples
- apply or check migrations
- render the minimal tenant seed
- print the API and web commands to run
- run smoke checks when services are available

### VPS deployment
Goal:
- prepare a small production deployment using the existing Docker/Caddy assets

Expected command shape:

```bash
npm run bootstrap:vps
```

This mode should:
- collect or validate `API_DOMAIN`, `WEB_DOMAIN`, `TLS_EMAIL`, and API/web environment values
- render `.env` files from checked-in examples without committing secrets
- validate that required Caddy and Docker Compose files exist
- check required ports and DNS assumptions where possible
- print the exact compose command for the selected stack

### OpenClaw integration
Goal:
- configure the accounting backend/plugin relationship with an OpenClaw host after the accounting platform is working

Expected command shape:

```bash
npm run bootstrap:openclaw
```

This mode should:
- verify API reachability
- collect OpenClaw host URL and supported version or companion-fork commit
- generate plugin configuration from the selected API base URL
- validate agent client credentials are present
- warn when the host does not meet required accounting capabilities

OpenClaw setup should be optional and should not block a human-operated accounting deployment.

## UX Shape
The first implementation should be a CLI wizard with a non-interactive mode.

Interactive mode:
- prompts for missing values
- writes generated local files only after confirmation
- prints validation results clearly
- avoids hiding dangerous actions behind a single silent command

Non-interactive mode:
- accepts flags and environment variables
- fails fast when required values are missing
- is suitable for CI, scripted VPS setup, and repeatable staging rebuilds

## State And File Rules
The bootstrap flow may create or update generated/local files such as:

- `apps/api/.env`
- `apps/web/.env`
- deployment `.env` files under `infra/docker/*`
- generated seed SQL under `infra/supabase/seeds/generated/`
- optional generated OpenClaw plugin config under an ignored generated path

The bootstrap flow must not:
- commit generated secrets
- write real credentials into tracked examples
- overwrite existing `.env` files without confirmation or explicit `--force`
- bypass migrations or tenant seed validation
- create production data silently

## Required Checks
Before reporting success, the bootstrap flow should verify:

- dependencies are installed or installable
- required migrations are present
- database connection succeeds
- minimal tenant seed can be rendered
- API environment has required values
- web environment has an API base URL
- Docker/Caddy assets are present for deployment modes
- OpenClaw host compatibility is known or explicitly marked unverified

## Smoke Checks
The first useful smoke checks are:

- `GET /api/v1/health`
- authenticated tenant-scoped report read
- `GET /api/v1/agent-tools/schema`
- web build for `apps/web`
- optional operator-console static deploy build
- optional OpenClaw plugin configuration validation

The smoke checks should produce a short report with pass/fail status and next actions.

## Error Handling
Errors should be actionable and mapped to setup categories:

- missing dependency
- missing environment value
- database connection failure
- migration not applied
- seed rendering failure
- tenant authorization failure
- API unreachable
- web build failure
- OpenClaw compatibility unknown

Each error should say what to fix and which file or command is involved.

## Implementation Order

1. Add a read-only bootstrap doctor command that validates local prerequisites.
2. Add environment template rendering for API and web.
3. Add minimal tenant seed rendering integration.
4. Add API and web smoke checks.
5. Add VPS deployment environment rendering.
6. Add OpenClaw compatibility/config validation.
7. Add CI-friendly non-interactive flags.

## Non-Goals For The First Version

- fully managed cloud provisioning
- automatic Supabase project creation
- automatic DNS management
- automatic production secret generation without operator review
- autonomous OpenClaw host patching
- migration rollback automation

## Acceptance Criteria

- A new technical operator can see one clear setup path for local evaluation, VPS deployment, and optional OpenClaw integration.
- The bootstrap plan covers database, storage, env templates, API, web, workers, and OpenClaw without overstating what is currently implemented.
- The flow protects secrets and generated files from being committed.
- The first implementation can start as validation and template rendering before it becomes a full deployment wizard.

