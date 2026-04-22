---
owner: Codex
status: in_progress
last_reviewed: 2026-04-10
---

# Supabase Install Options 01

## Purpose
Define the supported Supabase installation options for the OSS project, the support level for each option, and the practical setup differences between them.

## Default Backend Stance
This project is Supabase-first.

The supported backend posture is:
- hosted Supabase: recommended default
- self-hosted Supabase: supported
- plain Postgres without the Supabase layer: not the primary support target

The platform expects:
- Supabase Postgres for transactional and reporting data
- Supabase Auth for JWT-backed user identity
- Supabase Storage for documents, exports, and evidence artifacts
- Supabase-style RLS and migration flow

## Supported Install Matrix

| Option | Support Level | Recommended For | Summary |
| --- | --- | --- | --- |
| Hosted Supabase | recommended | most OSS users, evaluators, small teams, early deployers | fastest setup path with the least operational overhead |
| Self-hosted Supabase | supported | teams needing full infrastructure control, private-network deployments, stricter data residency posture | full-control path using the same schema, auth, and storage assumptions |
| Plain Postgres without Supabase | not primary | advanced experiments only | missing the default Auth, Storage, and project assumptions used by the platform |

## Option 1: Hosted Supabase

### Position
This is the recommended install path for most users.

### What the user provides
- a Supabase project
- project URL
- anon key
- database connection string
- storage buckets created in the Supabase project
- auth configured through Supabase Auth

### Why it is recommended
- lowest setup friction
- no need to operate the database/auth/storage control plane yourself
- easiest way to validate the OSS project quickly
- closest match to the current documentation and runtime assumptions

### Expected setup flow
1. create a hosted Supabase project
2. obtain:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `DATABASE_URL`
3. apply migrations from `infra/supabase/migrations`
4. create the expected Storage buckets
5. configure the API and later web/worker services to point at that project
6. create users and memberships in the platform data model

### Tradeoffs
- simplest operational path
- introduces a hosted dependency outside the app repo
- production posture depends partly on the managed Supabase plan and configuration choices

## Option 2: Self-Hosted Supabase

### Position
This is the supported full-control path.

### What the user provides
- a self-hosted Supabase deployment
- self-hosted Postgres, Auth, and Storage endpoints aligned with Supabase expectations
- the same environment values the app expects:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `DATABASE_URL`

### Why this option exists
- full infrastructure control
- private networking options
- stricter control over backups, data locality, and hardening
- better fit for organizations that do not want a managed Supabase dependency

### Expected setup flow
1. deploy Supabase in a self-hosted configuration
2. expose and secure the required endpoints
3. apply migrations from `infra/supabase/migrations`
4. create the expected Storage buckets and access policies
5. configure the API and later web/workers against the self-hosted Supabase stack
6. validate auth, storage, RLS, and reporting behavior

### Tradeoffs
- more operational overhead
- more moving parts to harden and monitor
- better control, but more responsibility for reliability and maintenance

## Option 3: Plain Postgres Without Supabase

### Position
This is not an officially prioritized install path.

### Why it is not primary
The platform architecture assumes:
- Supabase Auth
- Supabase Storage
- Supabase project configuration patterns
- Supabase-compatible JWT and RLS flow

Running on plain Postgres alone would require replacing or re-implementing:
- auth integration
- storage conventions
- parts of the deployment and configuration model

### Guidance
If someone wants to experiment here, it should be treated as an advanced fork/integration path rather than the default OSS promise.

## Required Supabase Services
Regardless of hosted or self-hosted deployment, the platform expects:

### Required
- Postgres database
- Auth
- Storage

### Expected database behavior
- migrations run successfully
- RLS enabled on tenant-owned tables
- SQL functions and views available for reporting

### Expected storage behavior
- bucket creation for:
  - `client-documents`
  - `bank-statements`
  - `working-papers`
  - `report-exports`
  - `audit-artifacts`

### Expected auth behavior
- bearer tokens verifiable by the backend
- user identity resolvable through `users.auth_user_id`
- tenant access enforced through memberships

## Environment Variables

Minimum API variables in the current runtime slice:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Later runtime slices will likely add:
- service-role credentials where needed for backend-controlled operations
- storage-specific settings
- worker and OpenClaw integration settings

## OSS Support Statement
Recommended OSS wording:

- hosted Supabase is the recommended setup path
- self-hosted Supabase is supported
- plain Postgres without the Supabase layer is not the primary support target

This avoids over-promising portability that the current architecture does not actually target.

## Bootstrap Implications
The future one-click bootstrap should ask the user to choose:
- hosted Supabase
- self-hosted Supabase

Then it should adapt:
- environment file generation
- migration instructions
- storage bucket setup guidance
- optional OpenClaw integration steps

## Acceptance Criteria
- The repo clearly distinguishes hosted and self-hosted Supabase options.
- The support level for each option is explicit.
- The docs do not imply that plain Postgres is equally supported.
- The install story remains aligned with the current Supabase-first architecture.
