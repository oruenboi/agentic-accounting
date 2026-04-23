---
owner: Codex
status: in_progress
last_reviewed: 2026-04-23
---

# Master PRD

## Initiative
Build a multi-tenant, agent-enabled accounting platform for accounting-firm operations.

## Current Focus
- Deliver the first operator UI runtime over the live backend workflow surface.
- Keep storage, auditability, approvals, and agent-safe API boundaries aligned with the operator experience.

## Clarifications
- Decision (2026-04-23): Use timestamp-prefixed SQL migrations under `infra/supabase/migrations/` with explicit constraint and function names; rely only on Supabase-supported defaults already used by the repo, including `gen_random_uuid()`.
