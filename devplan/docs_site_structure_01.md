---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Docs Site Structure 01

## Purpose
Define the structure of the public documentation site for the agentic accounting project. The docs site should make the repository easier to evaluate, adopt, and self-host without replacing `devplan/` as the working source of truth.

## Recommended Location
The docs site should live in `apps/docs`.

Why:
- it keeps documentation as a first-class application in the monorepo
- it separates polished public docs from planning artifacts
- it supports a future build/deploy pipeline without changing the source docs model
- it makes the docs site easy to run alongside `apps/api`, `apps/web`, and `apps/workers`

## Recommended Form
The docs site should be a static or mostly-static documentation app.

Recommended stack shape:
- React-based docs app
- MDX or Markdown-driven content
- navigation controlled by a small docs config file
- simple theming aligned with the product brand

Likely implementation candidates:
- Docusaurus-style structure
- Nextra-style structure
- a lightweight custom docs shell if the repo wants tighter design control later

For v1 planning purposes, the exact generator is less important than these properties:
- static-first
- easy to version
- easy to link from README
- easy to keep in sync with `devplan/`

## Docs Site Goals
The docs site should:
- present the project clearly to new visitors
- organize architecture and release docs into readable sections
- make self-hosting and OpenClaw integration understandable
- provide a public-facing home for release notes and roadmap context
- reduce the cognitive gap between `README.md` and the deeper planning documents

It should not:
- replace `devplan/`
- duplicate implementation work
- become a second source of truth for planning decisions

## Relationship To `README.md`
`README.md` should remain the short entry point.

Recommended split:

### `README.md`
Should contain:
- one-paragraph project summary
- target audience
- current maturity
- quick links to docs site, contributing, roadmap, and quickstarts
- concise self-host and OpenClaw pointers

### Docs site
Should contain:
- structured explanations
- architecture pages
- quickstarts
- contribution/governance pages
- roadmap/changelog pages
- detailed integration guidance

Rule:
- the README should point into the docs site
- the docs site should not try to re-explain the entire project in one landing page

## Relationship To `devplan/`
`devplan/` should remain the working source of truth for planning and design.

Recommended model:
- `devplan/` = internal planning/spec source
- `apps/docs` = curated public documentation surface

This avoids:
- over-polishing the wrong file tree
- losing planning context
- forcing every draft doc to be public immediately

Some docs can be promoted from `devplan/` to the docs site after stabilization.

## Top-Level Sections
The public docs site should be organized around the project’s real concepts, not around generic marketing pages.

Recommended top-level sections:

### Overview
- what the project is
- who it is for
- current maturity
- release posture

### Architecture
- tenancy and RBAC
- ledger and posting engine
- approvals
- auditability
- reporting
- schedules
- workflows and close process
- auth/client model

### Agent Integration
- tool execution model
- OpenClaw integration
- OpenClaw hardening and deployment boundary
- user/agent flow

### Deployment
- self-host quickstart
- operational setup
- packaging and distribution
- environment and release model

### Web UI
- route map
- component system
- role-based screen priorities
- operations-console workflow model

### OSS
- contributing
- governance
- roadmap
- changelog or release notes

### Reference
- API spec
- schema and implementation specs
- design glossary

## Suggested Page Map

### `/`
Landing page
- project summary
- key links
- maturity statement
- architecture highlights

### `/overview`
- project purpose
- who it is for
- current status

### `/architecture/*`
- tenancy
- ledger
- approvals
- audit
- reporting
- schedules
- workflows
- auth/client model

### `/agent-integration/*`
- agent tool model
- OpenClaw integration
- OpenClaw hardening
- user/agent flow

### `/deployment/*`
- self-host quickstart
- operational setup
- packaging and distribution
- OpenClaw deployment notes

### `/ui/*`
- route map
- component model
- role-based priorities

### `/oss/*`
- contributing
- governance
- roadmap
- changelog

### `/reference/*`
- API spec
- implementation-oriented specs
- glossary

## Content Promotion Model
Not every `devplan/` doc should immediately become a public docs page.

Suggested promotion tiers:

### Tier 1
Public docs immediately
- README
- contributing
- governance
- roadmap
- self-host quickstart
- OpenClaw quickstart

### Tier 2
Public docs after stabilization
- architecture docs
- API and implementation specs
- web UI docs

### Tier 3
Internal planning only
- detailed working notes
- partially shaped implementation plans
- exploratory drafts not yet ready for public exposure

## Navigation Expectations
The docs site navigation should be shallow and task-oriented.

Recommended nav behavior:
- Overview first
- Architecture second
- Deployment and integration third
- UI and OSS support docs later
- Reference section for deeper material

The site should help users answer:
- what is this
- how do I run it
- how do I integrate it with OpenClaw
- how do I contribute
- how do I inspect the architecture

## Branding And Tone
The docs site should be:
- clear
- direct
- technically honest
- calm and control-oriented

It should avoid:
- marketing fluff
- overpromising autonomous accounting
- presenting the planning docs as if they are already a finished product

## Monorepo Fit
In the monorepo, the docs site should sit beside the operational applications:

```text
apps/
  api/
  web/
  workers/
  docs/
packages/
infra/
devplan/
```

This makes the docs site a deployable artifact rather than an afterthought.

## Source Of Truth Rule
The docs site should be generated from or curated from stable documentation, but it should not become a free-form duplicate of working notes.

Practical rule:
- `devplan/` writes the intent
- `apps/docs` publishes the stable presentation

## Non-Goals For v1
- full CMS platform
- multi-author editorial workflow
- translation/i18n system
- forum or community portal
- public issue tracker mirror

## Dependencies
- README and release docs
- packaging/distribution plan
- OpenClaw integration docs
- operational setup docs
- governance and contributing docs

## Acceptance Criteria
- The docs site has a defined role in the monorepo.
- `apps/docs` is the recommended location.
- The docs stack is documented as static-first and Markdown/MDX-driven.
- The relationship between `README.md`, `devplan/`, and `apps/docs` is explicit.
- The top-level docs sections and page map are clear enough to guide implementation later.
