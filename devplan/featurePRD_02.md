---
owner: Codex
status: in_progress
last_reviewed: 2026-04-23
---

# Feature PRD 02

## Story
As an accounting operator, I need a desktop-first control console over proposals, approvals, posted entries, and audit timelines so I can review agent-assisted accounting work without raw SQL or ad hoc API calls.

## Product Direction Confirmed
- The first Web UI slice should be an internal operator console, not a marketing site or client portal.
- The initial runtime should sit in `apps/web` and consume the existing backend/API surface without introducing a parallel server or proxy layer.
- Human review remains primary. Agent-originated items must stay visually distinct from confirmed accounting state.
- The first UI slice should prioritize control loops that already exist in the backend:
  - proposal discovery
  - approval queues and resolution
  - posted-entry inspection
  - audit timeline review

## Acceptance Criteria
- The repo contains a new React-based `apps/web` workspace with a reusable app shell and responsive navigation.
- The app supports a minimal operator session bootstrap using configured API base URL, bearer token, organization context, and optional period context.
- The UI includes route families for:
  - `dashboard`
  - `proposals`
  - `approvals`
  - `ledger/entries`
  - `audit`
- The UI reuses documented primitives for queue tables, status badges, detail panels, loading states, empty states, and error states.
- The UI consumes the existing backend tool surface instead of inventing temporary mock-only flows for primary screens.
- The first UI slice includes automated tests for core API client behavior and at least one route/component render path.
- Planning docs explicitly resolve the proposal-route gap in the existing Web UI documentation.

## Dependencies
- Existing `apps/api` live tool surface.
- Existing role, route, and component planning docs.
- npm workspace root for adding `apps/web`.

## Resolved Decisions
- Decision (2026-04-23): Keep the first operator session bootstrap manual using API base URL, bearer token, organization ID, and optional period ID. A real Supabase web auth flow is deferred until the operator console proves its shape.
- Decision (2026-04-23): Keep draft discovery proposal-backed in the first UI slice. A dedicated `list_journal_entry_drafts` backend tool can follow after the first operator-console milestone if queue ergonomics demand it.
