---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Docs Publishing Model 01

## Purpose
Define how planning documents in `devplan/` should be promoted into a public docs site, how versioning should work, and how to prevent divergence between planning notes and published documentation.

## Design Principles
- `devplan/` is the working source of truth for architecture, planning, and implementation-facing specs.
- The docs site is the curated public-facing surface, not the only source of truth.
- Public docs should be stable, readable, and release-oriented.
- Planning docs may move faster than public docs, but the docs site must never contradict them.
- A clear promotion workflow is better than manual copy-paste publishing.

## Source-Of-Truth Model

### Working source
`devplan/` is the active planning and specification area.

It should contain:
- architecture decisions
- implementation-facing specs
- release-facing docs
- planning notes and current-state assessments

It is allowed to be detailed, iterative, and partially implementation-aware.

### Public docs site
The docs site should present the stable public view of the project.

It should contain:
- overview and product positioning
- architecture summaries
- self-host and OpenClaw quickstarts
- contribution and governance docs
- curated implementation guides where appropriate

The docs site should not expose half-formed internal planning churn unless that content is intentionally being published.

## Promotion Rules

### Promote to public docs when
Content is ready for external consumption and is stable enough not to mislead readers.

Good candidates:
- README material
- self-host quickstart
- OpenClaw quickstart
- architecture overview
- roadmap
- contribution guide
- governance guidance
- canonical UI/flow summaries

### Keep only in devplan when
Content is still moving quickly or is too implementation-adjacent for public consumption.

Examples:
- implementation-specific schema notes
- internal TODOs
- detailed rollout or migration sequencing
- draft-only control decisions

### Duplicate carefully
Some topics will exist in both places:
- `devplan/` has the detailed version
- docs site has the polished summary

This is acceptable only if the public page clearly maps to the same underlying decision set.

## Versioning Expectations

### Planning docs
Versioning should be lightweight.
- file naming can use numbered suffixes
- content can evolve as decisions are refined
- last-reviewed dates should be maintained

### Public docs
Public docs should be release-oriented.
- keep pages stable
- use explicit version or release notes where needed
- avoid exposing internal draft status unless that is the point of the page

### Compatibility
Public docs should align with the release or documentation set they describe.

Recommended rule:
- a public docs page should reference the platform/doc version it matches when versioning matters

## Review And Update Workflow

### Planning update flow
1. update or draft the relevant `devplan/` spec
2. capture the decision in the planning docs
3. identify whether the content needs public promotion
4. if yes, update the docs site source or mapping
5. review for consistency with the planning doc

### Public docs update flow
1. update the source planning doc if the change originated there
2. update the corresponding docs-site page
3. verify the public wording matches the current planning decision
4. update roadmap/changelog if the change affects release-facing behavior

### Review responsibility
Any meaningful change to:
- auth
- approval behavior
- tenant model
- ledger behavior
- OpenClaw integration
- deployment assumptions

should trigger a review of:
- the relevant `devplan/` spec
- the docs-site page, if one exists
- the README or quickstart if user-facing impact exists

## Divergence Prevention

### Single source of truth rule
Each topic should have one authoritative planning doc in `devplan/`.

The docs site should be derived from or aligned to that doc, not independently invented.

### Mapping table rule
Every public docs page should be traceable back to one or more planning docs.

Examples:
- docs overview -> `featurePRD_01.md`, `architecture_summary_01.md`
- self-host guide -> `operational_setup_01.md`, `packaging_distribution_01.md`
- OpenClaw guide -> `openclaw_integration_01.md`, `openclaw_distribution_hardening_01.md`
- UI docs -> `webui_routes_01.md`, `webui_components_01.md`, `webui_roles_priorities_01.md`

### Review checklist
Before promoting content to public docs, verify:
- terminology matches the planning docs
- no unsupported feature claims are introduced
- maturity/status statements are honest
- implementation gaps are not hidden

### Drift controls
Recommended drift controls:
- maintain a docs mapping index
- keep `last_reviewed` timestamps current in planning docs
- update `ROADMAP.md` or changelog when public docs change materially
- review the docs site whenever core planning docs change

## Publication Categories

### Always public-friendly
- README
- roadmap
- contribution guide
- governance guidance
- quickstarts

### Public if stable
- architecture overview
- UI route map
- OpenClaw integration guide
- deployment guidance

### Usually internal first
- implementation-facing schema docs
- detailed migration/rollout docs
- open TODOs

## Recommended Docs-Site Model
The docs site should be treated as a curated layer with:
- a limited navigation set
- stable language
- page mapping from `devplan/`
- release-friendly sequencing

It should not be treated as a second planning system.

## Non-Goals For V1
- full docs CMS workflow
- translation/localization pipeline
- docs version comparison tooling
- automatic sync from markdown without review

## Dependencies
- docs site structure
- docs site IA/navigation
- README and quickstart docs
- roadmap/changelog

## Acceptance Criteria
- The repo has an explicit model for `devplan/` as the working source and the docs site as the curated public layer.
- The promotion rules make clear what belongs in public docs and what remains in planning docs.
- The workflow defines how updates move from planning to public docs without contradictions.
- Divergence prevention is explicit enough to guide future docs-site implementation.
