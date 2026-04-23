---
owner: Codex
status: in_progress
last_reviewed: 2026-04-23
---

# Dev Plan 02

## Design
- Create `apps/web` as a Vite + React + TypeScript operator console workspace.
- Use TailwindCSS-based reusable UI primitives with tokenized colors, consistent status vocabulary, and desktop-first responsive behavior.
- Build the first slice around existing backend tools rather than adding a separate BFF:
  - `list_agent_proposals`
  - `get_agent_proposal`
  - `get_journal_entry_draft`
  - `list_approval_requests`
  - `list_assigned_approval_requests`
  - `get_approval_request`
  - `resolve_approval_request`
  - `escalate_approval_request`
  - `list_journal_entries`
  - `get_journal_entry`
  - `get_entity_timeline`
- Keep operator context explicit via a session bootstrap model:
  - API base URL
  - bearer token
  - organization ID
  - optional period ID
- Separate discovery queues from detail pages:
  - proposals queue -> proposal detail -> linked draft inspector
  - approvals queue -> approval detail -> approve/reject/escalate actions
  - journal entries queue -> entry detail -> audit links
- Add an audit timeline panel and dedicated route for entity history.
- Make agent-originated and human-confirmed states visually distinct using badges, provenance labels, and explain-first summary blocks.

## Information Architecture
- Primary nav for the first slice:
  - Dashboard
  - Proposals
  - Approvals
  - Posted Entries
  - Audit
- Drawer-first inspection where preserving queue context is valuable:
  - proposal preview
  - approval detail
  - audit timeline preview
- Full-page detail where URL-stable review is valuable:
  - proposal detail
  - approval detail
  - journal entry detail
  - audit timeline route

## Route Decisions
- Add explicit proposal route family to resolve the current planning gap:
  - `/proposals`
  - `/proposals/:proposalId`
- Keep the first implementation route set bounded:
  - `/dashboard`
  - `/proposals`
  - `/proposals/:proposalId`
  - `/approvals`
  - `/approvals/:approvalId`
  - `/ledger/entries`
  - `/ledger/entries/:entryId`
  - `/audit/:entityType/:entityId`
- Defer reports, schedules, close, tasks, and settings screens until after the first control-console milestone.

## Data And API
- Add `apps/web/src/lib/api.ts` as the typed browser client for the existing tool execution surface.
- Use a thin `executeTool` abstraction plus page-specific helpers for proposals, approvals, entries, and audit timelines.
- Normalize common operator payloads into stable UI-facing types in `apps/web/src/lib/types.ts`.
- Store operator session state locally in browser storage for the first milestone only; do not build a full auth/session backend yet.

## Testing Strategy
- Add Vitest + Testing Library for the web workspace.
- Cover:
  - API client success/error parsing
  - route/component render for at least one queue page and one detail page
  - a minimal session bootstrap state path
- Keep tests focused on contract handling and operator state presentation, not pixel snapshots.

## Risks
- The backend lacks dedicated draft-list discovery, so first-slice draft access should remain proposal-linked until a dedicated tool exists.
- Manual bearer-token bootstrap is operationally awkward, but it is the lowest-risk way to connect the first UI slice to the live backend.
- Route and role docs previously implied proposal surfaces without explicit proposal routes; those docs must be aligned during this slice.
- UI polish can drift if page-level code bypasses shared primitives, so the first slice should establish reusable tables, cards, badges, and panels early.

## Initial Build Slice
- App shell and session bootstrap.
- Dashboard with proposal/approval/entry summary cards and recent activity.
- Proposal queue and proposal detail with linked draft inspector.
- Approval queue and approval detail with resolve/escalate controls.
- Posted-entry list/detail and linked audit timeline.
