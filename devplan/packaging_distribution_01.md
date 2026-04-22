---
owner: Codex
status: in_progress
last_reviewed: 2026-04-07
---

# Packaging And Distribution 01

## Purpose
Define how the project should be packaged and distributed publicly, including the self-hostable platform shape, npm package strategy, OpenClaw integration packaging, and recommended repository structure for an open-source launch.

## Design Principles
- The full platform is a system, not just a library.
- Reusable developer-facing pieces should be published as installable packages.
- Deployable services should remain first-class applications in the monorepo.
- Public packaging should reflect the true architecture rather than pretending the whole platform is a single `npm install`.
- The distribution model should support both self-hosting and integration use cases.
- Supabase should be treated as the default supported backend for OSS distribution.

## Launch Form
Recommended launch form:
- open-source monorepo
- self-hostable platform
- separately published npm packages for integration and extension

This means the project should launch in two modes:

### 1. Platform mode
Users clone the repository and run the full system:
- API
- web app
- workers
- database migrations
- storage configuration

### 2. Package mode
Developers install focused packages for integration:
- SDK
- schemas
- domain rules
- OpenClaw plugin

## Why Not Only `npm install`
The platform depends on:
- Supabase Postgres migrations and RLS
- Supabase Storage buckets
- Supabase Auth assumptions
- backend services
- workers
- environment configuration

So the whole product cannot honestly be reduced to a single package install.

`npm install` is appropriate for reusable interfaces, not for the entire accounting platform.

## Recommended Public Repository Structure

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
  examples/
    api-client/
    openclaw/
  devplan/
```

### `apps/api`
Purpose:
- NestJS backend
- business workflows
- reporting and schedule APIs
- approval and audit logic

Distribution:
- deployed/self-hosted app
- not published as a generic npm library by default

### `apps/web`
Purpose:
- internal operator UI
- review, approvals, reporting, schedules, close workflow

Distribution:
- deployed/self-hosted app

### `apps/workers`
Purpose:
- background jobs
- exports
- schedule generation
- future async processing

Distribution:
- deployed/self-hosted worker service

### `packages/sdk`
Purpose:
- typed API client for backend and tool APIs

Distribution:
- publish to npm

Recommended name:
- `@agentic-accounting/sdk`

### `packages/schemas`
Purpose:
- JSON schema / zod contracts for tools and APIs

Distribution:
- publish to npm

Recommended name:
- `@agentic-accounting/schemas`

### `packages/domain`
Purpose:
- pure accounting domain types and logic
- reusable validation and classification helpers

Distribution:
- publish to npm once stabilized

Recommended name:
- `@agentic-accounting/domain`

### `packages/openclaw-plugin`
Purpose:
- OpenClaw integration package
- plugin/runtime adapter for the accounting backend

Distribution:
- publish to npm

Recommended name:
- `@agentic-accounting/openclaw-plugin`

### `packages/config`
Purpose:
- shared TypeScript, lint, or build config

Distribution:
- optional npm package
- often internal-only unless there is a real external use case

### `infra/supabase`
Purpose:
- schema migrations
- RLS
- SQL functions and views

Distribution:
- part of the self-hosted platform
- not a standalone npm package

### `infra/docker`
Purpose:
- local orchestration
- self-hosted bootstrap

Distribution:
- part of the repo

### `examples`
Purpose:
- show how to use the SDK or OpenClaw plugin
- reduce adoption friction

Examples to include:
- backend API client example
- OpenClaw plugin example

## Recommended npm Package Set

### Publish in the first public wave
- `@agentic-accounting/sdk`
- `@agentic-accounting/schemas`
- `@agentic-accounting/openclaw-plugin`

### Publish later, after stabilization
- `@agentic-accounting/domain`

### Optional / likely internal only
- `@agentic-accounting/config`

## Package Responsibilities

### `@agentic-accounting/sdk`
Should include:
- typed REST client
- typed tool execution client
- request/response types
- auth header helpers
- pagination and error helpers

Should not include:
- business state
- secret management
- server-only workflow logic

### `@agentic-accounting/schemas`
Should include:
- tool input schemas
- tool output schemas
- report schemas
- shared DTO validation

Should not include:
- network clients
- runtime secrets

### `@agentic-accounting/domain`
Should include:
- account types
- posting validation helpers
- reporting classification helpers
- pure rules that do not depend on NestJS or Supabase runtime

Should not include:
- DB access
- framework-dependent services

### `@agentic-accounting/openclaw-plugin`
Should include:
- tool registration
- backend client integration
- metadata/capability declarations
- approval and tenant-context handoff integration

Should not include:
- durable accounting state
- backend enforcement logic

## Open-Source Positioning
Recommended position:
- self-hostable accounting operations platform
- with installable npm packages for SDK, schemas, domain rules, and OpenClaw integration

Do not position it as:
- a single-package drop-in accounting system
- a fully autonomous bookkeeping package

## Self-Hosting Distribution
The platform distribution should support:
- cloning the repo
- connecting to a hosted Supabase project or self-hosted Supabase stack
- setting environment variables
- running migrations
- starting API, web, and worker processes

Recommended supporting assets:
- root README
- environment example files
- Docker or compose setup
- migration bootstrap instructions

Supported backend posture:
- hosted Supabase is the fastest supported OSS setup path
- self-hosted Supabase is the full-control setup path
- plain Postgres without the Supabase layer is not the primary support target

## Public Release Strategy

### Phase 1
Release:
- monorepo structure
- docs
- migrations
- platform skeleton
- npm packages for `sdk`, `schemas`, `openclaw-plugin`

### Phase 2
Release:
- stable `domain` package
- examples
- improved self-host docs

### Phase 3
Release:
- production-ready self-host guidance
- optional managed/commercial add-ons later, outside this core planning document

## Versioning Expectations
- version npm packages independently or in a coordinated monorepo release strategy
- keep schema and SDK version compatibility explicit
- document which platform release aligns with which package versions

V1 recommendation:
- start with coordinated versioning for simplicity

## Documentation Expectations
The public repo should include:
- root architecture overview
- self-host quickstart
- package-by-package README files
- OpenClaw integration guide
- environment and migration guide
- explicit non-goals and maturity statement

## Non-Goals For V1
- single-command fully managed cloud deploy
- one-package install for the entire accounting system
- marketplace-first packaging before the backend is stable

## Dependencies
- OSS launch strategy
- OpenClaw integration design
- operational setup
- API auth/client model

## Acceptance Criteria
- The repo has a clear split between deployable apps and publishable packages.
- The npm package set is defined with concrete names and responsibilities.
- The packaging model matches the real system architecture.
- The OSS launch shape supports both self-hosting and developer integration without pretending the entire platform is just one package.
