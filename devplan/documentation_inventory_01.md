---
owner: Codex
status: in_progress
last_reviewed: 2026-04-10
---

# Documentation Inventory 01

## Purpose
This document tracks whether the topics discussed during planning are fully documented in the repo, only partially documented, or not yet documented.

Statuses:
- `documented`
- `partially documented`
- `not documented`

## Topic Inventory

| Topic | Status | Current Source |
| --- | --- | --- |
| Product story and platform direction | documented | `featurePRD_01.md` |
| Multi-tenant model (`firm` / `organization`) | documented | `devplan_01.md`, tenant migration |
| Ledger as source of truth | documented | `featurePRD_01.md`, `devplan_01.md` |
| Double-entry and immutable posted entries | documented | `ledger_posting_engine_01.md`, ledger migrations |
| Auditability strategy | documented | `auditability_strategy_01.md` |
| Audit schema details | documented | audit migration |
| Approval header and action model | documented | `approval_behavior_01.md`, approval migrations |
| Application logic layering | documented | `application_logic_01.md` |
| Backend architecture summary | documented | `architecture_summary_01.md` |
| User flow and agent flow | documented | `user_agent_flow_01.md` |
| Reporting SQL implementation layer | documented | `reporting_sql_implementation_01.md` |
| Idempotency schema implementation layer | documented | `idempotency_schema_01.md` |
| Agent proposal schema implementation layer | documented | `agent_proposal_schema_01.md` |
| Schedule schema implementation layer | documented | `schedule_schema_implementation_01.md` |
| Agent tool execution implementation layer | documented | `agent_tool_execution_01.md` |
| Storage strategy | documented | `storage_blueprint_01.md` |
| Reporting strategy | documented | `reporting_design_01.md` |
| Balance sheet schedule strategy | documented | `schedule_engine_01.md` |
| Concrete v1 API spec | documented | `api_spec_v1_01.md` |
| Tenant / RBAC and RLS strategy | documented | `devplan_01.md`, tenant migration |
| Ledger schema | documented | ledger migrations |
| Ledger DB guards | documented | ledger guard migration |
| Approval system header model | documented | approval migration |
| Idempotency design | documented | `idempotency_design_01.md` |
| Agent proposal model | documented | `agent_proposals_01.md` |
| File/document model | documented | `document_model_01.md` |
| Task / exception workflow | documented | `workflow_close_01.md` |
| Background job architecture | documented | `background_jobs_01.md` |
| Close process | documented | `workflow_close_01.md` |
| Audit read model | documented | `audit_read_model_01.md` |
| Testing strategy in detail | documented | `testing_strategy_01.md` |
| Operational setup | documented | `operational_setup_01.md` |
| OpenClaw integration split | documented | `openclaw_integration_01.md` |
| OpenClaw readiness boundary | documented | `devplan_01.md`, `openclaw_integration_01.md` |
| OpenClaw plugin-only changes | documented | `openclaw_integration_01.md` |
| OpenClaw core changes | documented | `openclaw_integration_01.md` |
| Rollout phases for agent enablement | documented | `featurePRD_01.md`, `openclaw_integration_01.md` |
| Supabase install options and support matrix | documented | `supabase_install_options_01.md` |
| Web UI route map | documented | `webui_routes_01.md` |
| Web UI component system | documented | `webui_components_01.md` |
| Web UI role visibility and screen priority | documented | `webui_roles_priorities_01.md` |

## Immediate Documentation Priorities
No blocking documentation gaps remain.

Remaining work is implementation-facing and/or release-polish oriented:

1. Implementation of documented designs
2. Optional release/readme authoring docs
3. Optional packaging polish and examples
4. Optional OpenClaw example walkthroughs

## Additional Architecture Coverage
- `api_auth_client_model_01.md` now covers authentication, client identity, delegated agent context, and tenant enforcement for user, service, and agent callers.
- `packaging_distribution_01.md` now covers the OSS launch form, public monorepo structure, self-hosted platform shape, and npm package responsibilities.
- `openclaw_distribution_hardening_01.md` now covers repo boundaries with OpenClaw, companion-fork strategy, deployment topology, and Ansible hardening scope.
- `ledger_posting_engine_01.md` now covers draft validation, posting order, reversals, period controls, and organization-consistency rules for double-entry posting.
- `user_agent_flow_01.md` now covers the concrete human and agent workflow sequences for journals, approvals, schedules, exceptions, reconciliation-style review, and period close.
- `idempotency_schema_01.md` now covers the implementation-facing idempotency key table and replay/conflict behavior.
- `agent_proposal_schema_01.md` now covers the implementation-facing durable proposal table and its confidence, disambiguation, approval, and audit linkage.
- `reporting_sql_implementation_01.md` now covers the implementation-facing SQL objects for trial balance, balance sheet, P&L, and general ledger.
- `schedule_schema_implementation_01.md` now covers the implementation-facing schedule definition, run, row, and reconciliation tables for balance sheet schedules.
- `agent_tool_execution_01.md` now covers the implementation-facing tool registry, request envelope, tenant enforcement, approval integration, and execution flow for agent tools.
- `README.md` now provides the public OSS-facing project overview and maturity statement.
- `self_host_quickstart_01.md` now provides a release-facing self-host bootstrap guide.
- `openclaw_quickstart_01.md` now provides a release-facing OpenClaw integration quickstart.
- `CONTRIBUTING.md` now provides contribution guidance for planning-first and implementation work.
- `GOVERNANCE.md` now provides maintainership and licensing/governance guidance.
- `ROADMAP.md` now provides a release-facing roadmap and lightweight changelog.
- `webui_routes_01.md` now covers the Web UI page map and route structure.
- `webui_components_01.md` now covers the Web UI component and interaction system.
- `webui_roles_priorities_01.md` now covers Web UI role visibility, permissions, device emphasis, and v1 screen priorities.
- `docs_site_structure_01.md` now covers the recommended `apps/docs` site structure and public/private docs split.
- `docs_site_ia_01.md` now covers docs-site navigation, section hierarchy, and page mapping from the current docs set.
- `docs_publishing_model_01.md` now covers the source-of-truth and publishing workflow between `devplan/` and the future docs site.
- `backend_processes_01.md` now covers synchronous, async, scheduled, maintenance, and agent-specific backend process classes.
- `supabase_install_options_01.md` now covers hosted Supabase vs self-hosted Supabase, service expectations, environment values, and OSS support posture.

## Notes
- "Documented" means the repo has a stable written artifact that captures the topic well enough to guide implementation.
- "Partially documented" means the topic is mentioned or implied, but not yet captured as a standalone or sufficiently detailed design.
- "Not documented" means the topic currently exists only in chat or loose planning references.
