---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Docs Site IA 01

## Purpose
Define the information architecture and navigation model for the public documentation site. The docs site should present the documented architecture in a clean, release-facing form without replacing `devplan/` as the planning source of truth.

## Design Principles
- The docs site is a curated public surface, not a dump of every planning note.
- `devplan/` remains the working source for planning and implementation guidance.
- Public docs should prioritize clarity, onboarding, and stable conceptual references.
- The docs site should mirror the actual product shape: multi-tenant accounting, agent workflows, OpenClaw integration, and self-hosted deployment.
- Navigation should be shallow enough for discovery, but structured enough to support deep technical reading.

## Site Role
The docs site should serve:
- prospective adopters
- self-host operators
- contributors
- OpenClaw integrators
- internal reviewers who need a polished reference surface

It should not serve as:
- the sole source of development truth
- a replacement for implementation specs in `devplan/`
- a marketing-only site with no technical depth

## Recommended Top-Level Navigation

### 1. Overview
Purpose:
- explain the project at a high level
- show current maturity
- orient readers to what the platform is and is not

Pages:
- `Overview`
- `Architecture at a Glance`
- `Current Status`

### 2. Architecture
Purpose:
- explain the accounting control model and major subsystems

Pages:
- `Tenancy and RBAC`
- `Ledger and Double-Entry`
- `Approvals`
- `Auditability`
- `Reporting`
- `Schedules`
- `Workflow and Close`
- `Auth and Client Model`

### 3. Agent Integration
Purpose:
- explain the agent interface and the OpenClaw relationship

Pages:
- `Agent Tool Model`
- `OpenClaw Integration`
- `OpenClaw Deployment and Hardening`
- `Human and Agent Flows`

### 4. Deployment
Purpose:
- help teams self-host and operate the platform

Pages:
- `Self-Host Quickstart`
- `Operational Setup`
- `Packaging and Distribution`
- `Environment and Migrations`

### 5. Web UI
Purpose:
- describe the operations console and its screen structure

Pages:
- `UI Overview`
- `Route Map`
- `Component Model`
- `Role Visibility and Screen Priorities`

### 6. OSS
Purpose:
- explain how to contribute and how the project is governed

Pages:
- `Contributing`
- `Governance`
- `Roadmap`
- `Changelog`

## Proposed Section Hierarchy

### Overview
- Project summary
- Target users
- Maturity statement
- What is implemented vs planned

### Architecture
- Multi-tenant model
- Ledger source of truth
- Posting engine
- Approvals and audit
- Reporting and schedules
- Workflow and close
- Auth/client model

### Agent Integration
- Agent tool execution model
- OpenClaw plugin relationship
- Host boundary and hardening
- Safe read/propose/commit sequencing
- Example workflows

### Deployment
- Self-host quickstart
- Operational setup
- Package distribution
- OpenClaw deployment notes

### Web UI
- App shell
- Navigation and routes
- Queue-first screens
- Shared components
- Role-based screen access

### OSS
- Contribution process
- Governance and maintenance
- Roadmap
- Changelog

## Page Mapping From Current Docs
The docs site should primarily republish or reframe existing docs rather than inventing a new separate narrative.

### Overview pages
- `README.md`
- `ROADMAP.md`

### Architecture pages
- `architecture_summary_01.md`
- `api_auth_client_model_01.md`
- `ledger_posting_engine_01.md`
- `approval_behavior_01.md`
- `auditability_strategy_01.md`
- `reporting_design_01.md`
- `schedule_engine_01.md`
- `workflow_close_01.md`

### Agent Integration pages
- `api_spec_v1_01.md`
- `openclaw_integration_01.md`
- `openclaw_distribution_hardening_01.md`
- `user_agent_flow_01.md`
- `agent_tool_execution_01.md`
- `packaging_distribution_01.md`

### Deployment pages
- `self_host_quickstart_01.md`
- `operational_setup_01.md`
- `packaging_distribution_01.md`
- `openclaw_quickstart_01.md`

### Web UI pages
- `webui_routes_01.md`
- `webui_components_01.md`
- `webui_roles_priorities_01.md`

### OSS pages
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `ROADMAP.md`

## Public Page Curation Model
The docs site should not expose every internal planning detail directly.

### Promote to public docs
Promote content when it is:
- stable
- architecture-level
- useful to adopters or contributors
- not tied to temporary implementation churn

Good candidates:
- product overview
- architecture summaries
- deployment guidance
- interface and integration docs
- UI and workflow explainers
- contribution and governance docs

### Keep in `devplan/`
Keep content in `devplan/` when it is:
- implementation-in-progress
- schema-specific
- highly detailed and likely to change
- primarily useful to maintainers or implementers

Examples:
- migration planning
- detailed SQL rollout steps
- low-level implementation specs
- temporary task lists

### Mirror carefully
The docs site should link to, summarize, or republish only the stable parts of `devplan/`.

Do not create two competing sources of truth.

## Suggested URL Structure

```text
/docs
/docs/overview
/docs/architecture/tenancy
/docs/architecture/ledger
/docs/architecture/approvals
/docs/architecture/auditability
/docs/architecture/reporting
/docs/architecture/schedules
/docs/architecture/workflow-close
/docs/agent-integration/openclaw
/docs/agent-integration/tool-model
/docs/deployment/self-host
/docs/deployment/operational-setup
/docs/web-ui/routes
/docs/web-ui/components
/docs/web-ui/roles-priorities
/docs/oss/contributing
/docs/oss/governance
/docs/oss/roadmap
```

## Suggested Site Behavior
- left nav with top-level sections
- sticky in-page table of contents
- search across all public docs
- callout boxes for maturity and non-goals
- code-block friendly rendering for configuration examples
- clear source labels when content is derived from `devplan/`

## Documentation Promotion Rules
When promoting docs from `devplan/` to the site:
- keep terminology consistent
- preserve the architecture decisions already documented
- avoid rewriting the meaning of the planning docs
- add editorial transitions instead of inventing new product claims
- link back to the canonical planning doc when the public page is derived from it

## Recommended Build Order
1. Overview and architecture pages
2. Deployment and quickstart pages
3. Agent integration pages
4. Web UI pages
5. OSS pages
6. Search, navigation polish, and cross-links

## Non-Goals For V1
- full CMS or blog platform
- public issue tracker replacement
- auto-generated docs without curation
- a docs site that becomes the hidden source of truth instead of `devplan/`

## Dependencies
- README and release-facing docs
- the architecture and deployment planning docs
- Web UI planning docs
- OpenClaw integration docs

## Acceptance Criteria
- The docs site has a clear top-level navigation model.
- The current docs map cleanly into public pages.
- The site distinguishes between curated public docs and internal planning docs.
- The site supports the product, agent, deployment, UI, and OSS story without duplicating the entire `devplan/` tree.
