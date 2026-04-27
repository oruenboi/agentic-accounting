# Contributing to Agentic Accounting

This repository is being built as an open-source, multi-tenant accounting control plane for firms and agent-assisted workflows. The planning and documentation layer is currently ahead of the runtime implementation, so contributions should follow the documented architecture rather than improvising new product shape.

## Project Maturity

The repo is currently documentation-first and schema-first.

What is already defined:
- multi-tenant `firm` / `organization` model
- ledger source of truth and double-entry posting model
- audit, approval, reporting, schedule, and workflow design
- OpenClaw integration and packaging strategy
- release-facing README and quickstart docs

What is still being implemented:
- broader runtime API services beyond the current journal, approval, audit, and reporting slices
- schedule execution and worker processes
- OpenClaw plugin package and host integration
- release hardening, examples, and operational automation

Contributions should assume the docs are authoritative until implementation work catches up.

## Contribution Expectations

- Keep changes aligned with the existing planning docs in `devplan/`.
- Prefer small, reviewable pull requests.
- Do not change accounting behavior, schema shape, or agent flow without updating the relevant planning doc first.
- Preserve tenant isolation, approval gating, auditability, and posted-entry immutability.
- Do not assume a single-company or single-user model.
- If a change affects external behavior, update docs alongside the code.

## Planning-First Workflow

Before implementing a feature or schema change:

1. Review `devplan/masterPRD.md`.
2. Check the corresponding feature PRD, dev plan, and TODO file.
3. Update `devplan/todo_01.md` before writing code if the work is not already tracked.
4. Add or update the relevant design doc if the change is architectural or cross-cutting.
5. Only then implement code or migrations.

For most changes, the planning chain should be:
- `devplan/masterPRD.md`
- `devplan/featurePRD_##.md`
- `devplan/devplan_##.md`
- `devplan/todo_##.md`

If a topic is missing from the docs, document it first rather than guessing.

## Working With `devplan/`

The `devplan/` directory is the source of truth for product and implementation planning.

Use it for:
- PRD scope
- architecture decisions
- data model decisions
- rollout ordering
- implementation tasks
- documentation inventory

When updating docs:
- keep frontmatter intact
- use clear ownership and status fields
- add only one topic per document where practical
- prefer standalone specs for complex concerns

If a task is completed, update the TODO file as part of the same change set.

## Schema, Docs, And Implementation

If a change touches schema, align these layers:

- `devplan/` docs describe the intended model
- `infra/supabase/migrations/` define the database shape
- application code should follow the documented service boundaries

For database work:
- keep tenant columns on tenant-owned tables
- maintain append-only behavior for audit and posted ledger data
- use reversible corrections rather than in-place edits where the docs require it
- keep write-path enforcement compatible with the approval and idempotency model

For agent-facing changes:
- require explicit tenant context
- preserve auditability and replay safety
- route mutations through approval-aware application services

## Testing And Documentation Expectations

Every meaningful contribution should include:
- tests for new behavior where the runtime exists
- schema or policy validation for migration work
- doc updates for behavior, workflow, or architectural changes

If the implementation is not present yet, update the docs and TODOs instead of forcing code.

Suggested verification expectations:
- migration syntax or integrity checks for SQL changes
- policy / RLS tests where applicable
- integration tests for approval, posting, reporting, or agent-tool behavior

## Issue And PR Guidance

When opening an issue:
- describe the observed problem
- cite the affected doc or file if known
- distinguish between planning work, schema work, and runtime work
- include the expected accounting or workflow behavior

When opening a pull request:
- keep the scope narrow
- link to the relevant `devplan/` doc or TODO item
- explain any deviations from the documented model
- include test or validation evidence
- update docs if the implementation changes the design

Good PRs in this repo are usually one of these:
- documentation-only updates
- schema/migration updates that match a documented spec
- backend implementation that closes a documented task
- release-facing polish such as README or quickstart improvements

## OpenClaw And Agent Contributions

If you are contributing around OpenClaw integration:
- treat the accounting backend as the source of truth
- keep OpenClaw host changes separate from accounting-platform changes
- document plugin, host, and deployment boundaries clearly
- preserve approval, tenant, and audit semantics end to end

## Not Yet Finalized

Some items in the repo are intentionally still under implementation or release planning. If you encounter one of them, do not redefine it casually. Update the appropriate planning document first.

## Style

- Use ASCII unless there is a strong reason not to.
- Keep changes pragmatic and tightly scoped.
- Prefer clarity over cleverness.
- Avoid reformatting unrelated files.

## If You Are Unsure

If a contribution touches accounting logic, tenant isolation, approvals, or agent behavior, update the relevant `devplan/` document first or ask for clarification before implementing.
