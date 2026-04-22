---
owner: Codex
status: in_progress
last_reviewed: 2026-04-07
---

# Dev Plan 01

## Design
- Create `audit_logs` as the append-only event journal for user, agent, and system actions.
- Create `approval_actions` as the immutable per-step history for approval workflows.
- Use JSONB for compact before/after state and event metadata payloads.
- Use `firms` and `organizations` as the tenancy model, with membership-driven access.
- Use a draft-to-posted ledger lifecycle, with reversals instead of in-place correction.
- Expose accounting capabilities later as agent-safe tool APIs, not raw CRUD writes.

## Data
- Add UUID primary keys with `gen_random_uuid()`.
- Add actor, entity, request, approval, and provenance columns.
- Add targeted indexes for organization, entity, request, and agent-run queries.
- Add tenant tables: `firms`, `users`, `organizations`, `firm_members`, `organization_members`.
- Add ledger tables: `organization_sequences`, `accounting_periods`, `accounts`, `journal_entry_drafts`, `journal_entry_draft_lines`, `journal_entries`, `journal_entry_lines`, `journal_entry_reversals`.
- Add guard functions and triggers for period overlap protection, posted-row immutability, and balanced posted journals.
- Add idempotency, agent proposal, reporting SQL, schedule, and ledger write-path guard schema objects needed for the first implementation pass.

## Migrations
- Added:
  - `202604020001_audit_schema.sql`
  - `202604020002_tenant_schema.sql`
  - `202604020003_ledger_schema.sql`
  - `202604020004_ledger_guards.sql`
  - `202604030001_approval_requests.sql`
  - `202604070001_idempotency_keys.sql`
  - `202604070002_agent_proposals.sql`
  - `202604070003_ledger_write_path_guards.sql`
  - `202604070004_reporting_sql.sql`
  - `202604070005_schedule_schema.sql`

## Runtime Progress
- Added an npm workspace root with an initial `apps/api` NestJS service.
- Added Supabase-backed bearer-token verification using `@supabase/supabase-js`.
- Added a Postgres-backed database service using `pg` and `DATABASE_URL`.
- Added tenant access checks that resolve `users.auth_user_id` against `organization_members` and elevated `firm_members`.
- Added read-only endpoints for health, trial balance, balance sheet, profit and loss, and general ledger.

## Integration Documents
- `openclaw_integration_01.md` documents the split between plugin-only work, OpenClaw core changes, backend changes, and phased rollout for accounting-agent support.
- `documentation_inventory_01.md` tracks what has and has not yet been fully documented.
- `architecture_summary_01.md` captures the backend and integration architecture at a high level.
- `api_spec_v1_01.md` captures the concrete v1 API direction discussed during planning.
- `idempotency_design_01.md` captures the replay-safety model for all mutating accounting operations.
- `agent_proposals_01.md` captures the durable proposal layer between agent intent and accounting mutation.
- `reporting_design_01.md` captures the canonical SQL-oriented reporting model for trial balance, balance sheet, P&L, and general ledger.
- `schedule_engine_01.md` captures the v1 balance sheet schedule engine design, reconciliation rules, and workflow expectations.
- `storage_blueprint_01.md` captures the concrete storage model across Postgres, Supabase Storage, views, snapshots, and retention boundaries.
- `workflow_close_01.md` captures task, exception, and accounting-period close workflow design, including blockers, ownership, and signoff flow.
- `audit_read_model_01.md` captures how audit, approval, lineage, and period-evidence data should be queried and presented to reviewers and operators.
- `document_model_01.md` captures the attachment, evidence, and file-linking model used by approvals, schedules, reports, and close workflows.
- `background_jobs_01.md` captures the async execution model for schedule generation, report exports, retries, locking, and failure recovery.
- `operational_setup_01.md` captures environment layout, migration flow, backups, observability, release controls, and runbook expectations.
- `testing_strategy_01.md` captures the detailed testing model across unit, integration, database, policy, async, API, and agent-facing layers.
- `application_logic_01.md` captures the application-layer service boundaries, policy orchestration, transaction ownership, and workflow state management.
- `approval_behavior_01.md` captures routing, escalation, delegation, expiry, and decision behavior for approval workflows.
- `auditability_strategy_01.md` captures the standalone audit control goals, immutable event expectations, provenance requirements, and evidence-retention model.
- `api_auth_client_model_01.md` captures the authentication, client identity, delegated agent, and tenant-context enforcement model across user, service, and agent callers.
- `packaging_distribution_01.md` captures the OSS launch form, self-hosted monorepo structure, and npm package distribution strategy.
- `openclaw_distribution_hardening_01.md` captures the OpenClaw repo boundary, companion-fork/upstream strategy, integrated deployment topology, and Ansible hardening scope.
- `ledger_posting_engine_01.md` captures the behavioral double-entry posting engine, including draft lifecycle, validation order, reversals, and period/org consistency rules.
- `user_agent_flow_01.md` captures the concrete human and agent workflow sequences for journals, schedules, approvals, exception handling, reconciliation-style review, and period close.
- `idempotency_schema_01.md` captures the implementation-facing idempotency key table and replay/conflict behavior.
- `agent_proposal_schema_01.md` captures the implementation-facing durable proposal table and its confidence, disambiguation, approval, and audit linkage.
- `reporting_sql_implementation_01.md` captures the canonical SQL objects for trial balance, balance sheet, P&L, and general ledger.
- `schedule_schema_implementation_01.md` captures the schedule definition, run, row, and reconciliation tables for balance sheet schedules.
- `agent_tool_execution_01.md` captures the tool registry, request envelope, tenant enforcement, approval integration, and execution flow for agent tools.
- `README.md` captures the OSS-facing project summary and current maturity statement.
- `self_host_quickstart_01.md` captures the release-facing self-host bootstrap sequence.
- `openclaw_quickstart_01.md` captures the release-facing OpenClaw integration bootstrap sequence.
- `CONTRIBUTING.md` captures contributor workflow, planning expectations, and issue/PR guidance.
- `GOVERNANCE.md` captures maintainership posture, OpenClaw boundary guidance, and licensing/governance expectations.
- `ROADMAP.md` captures the release-oriented roadmap and lightweight changelog for the project.
- `webui_routes_01.md` captures the Web UI page map and route structure.
- `webui_components_01.md` captures the Web UI component system and interaction patterns.
- `webui_roles_priorities_01.md` captures Web UI role visibility, permissions, device emphasis, and screen priorities.
- `docs_site_structure_01.md` captures the future docs-site placement, stack direction, and top-level structure.
- `docs_site_ia_01.md` captures the docs-site navigation model and page mapping from current source docs.
- `docs_publishing_model_01.md` captures how `devplan/` remains the working source while curated content is promoted into a public docs site.
- `backend_processes_01.md` captures the overall backend process map across synchronous requests, workers, scheduled jobs, maintenance processes, and agent-specific execution.

## Confirmed Storage Direction
- Supabase Postgres is the canonical transactional store.
- Supabase Storage will hold documents, working papers, and exports.
- SQL views will power canonical reporting.
- Materialized views are deferred until performance justifies them.
- Redis is intentionally deferred; correctness and control take priority over caching.

## Confirmed API Direction
- Internal UI will use REST-style application endpoints.
- Agents will use a tool-oriented execution API with strict schemas, approval gating, and idempotent writes.
- Every financial mutation must be auditable, tenant-scoped, and approval-aware.

## OpenClaw Readiness Status
- Current state is not ready for live autonomous accounting actions.
- Current state is suitable only as a backend foundation for future agent enablement.
- Minimum prerequisites before agent writes:
  - `approval_requests`
  - `idempotency_keys`
  - `agent_proposals`
  - policy engine
  - authenticated tool execution layer
  - reporting and schedule APIs
  - application-layer use of closed-period enforcement in write paths
  - end-to-end use of org-consistency checks across ledger references
- OpenClaw can support a prototype through a dedicated accounting plugin, but production use requires targeted host-side enhancements documented in `openclaw_integration_01.md`.

## OSS Readiness Distinction
- The repo is close to a public documentation-first OSS release.
- The repo is not yet a usable self-hostable OSS product release.

### Close to ready for a public documentation-first OSS release
- architecture and planning documents are in place
- OSS-facing README, quickstarts, governance, roadmap, and contribution docs exist
- schema foundations for audit, tenancy, ledger, and approvals exist

### Still required for a usable self-hostable OSS release
- `idempotency_keys` schema and runtime implementation
- `agent_proposals` schema and runtime implementation
- reporting SQL views/functions
- schedule schema and generation runtime
- agent tool execution/auth wiring
- application-layer org-consistency and closed-period enforcement in write paths
- backend/API skeleton
- web UI runtime
- worker/background job runtime
- bootstrap/setup automation for database, storage, env templates, API, web, workers, and optional OpenClaw setup
- CI/release pipeline and package publishing workflow

### Remaining public-release blockers even for a docs-first OSS release
- choose and publish a final OSS license
- add a security policy / responsible disclosure path
- finalize public-facing docs for publication quality
- decide and state the initial OpenClaw fork/upstream support stance explicitly

## Testing Strategy
- Validate migration syntax by inspection in this pass.
- Add migration execution and policy tests once the Supabase project scaffold exists.
- Add DB-level tests for ledger guards and RLS before exposing any agent write surface.
- Add integration tests for approval-gated posting, reversal flows, and audit linkage.

## Risks
- Extension assumptions may differ from the eventual Supabase setup.
- `approval_requests` now anchors approval linkage, but routing, escalation, and expiry enforcement are still application-layer concerns.
- Current RLS covers read isolation, but write-path protections are still backend-policy-dependent.
- Balance checking, org-consistency checks, and closed-period validation now exist at the database layer, but reporting queries, schedules, idempotency, and proposals still need application-layer integration.

## Major Remaining Gaps
- Implementation of documented designs
- Final OSS release decisions:
  - license
  - security policy
  - OpenClaw support stance
  - bootstrap/setup strategy

## Approval Model Status
- `approval_requests` is the header table for approval lifecycle state.
- `approval_actions` remains the immutable action history.
- Routing, escalation, delegation, and expiry handling still need application-layer design.
