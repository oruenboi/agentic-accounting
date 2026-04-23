---
owner: Codex
status: in_progress
last_reviewed: 2026-04-23
---

# TODO 02

- [x] Review the active backend and Web UI planning docs and choose the thinnest first operator-console slice backed by live APIs.
- [x] Resolve the planning gap around proposal routes and first-slice screen scope before coding.
- [x] Scaffold `apps/web` as a React + TypeScript operator console workspace with Tailwind-based reusable primitives and root workspace scripts.
- [x] Add a minimal operator session bootstrap for API base URL, bearer token, organization ID, and optional period ID.
- [x] Add `src/lib/api.ts` and typed helpers for proposal, approval, journal-entry, and audit timeline tool execution.
- [x] Build the first app shell with responsive navigation, context summary, loading states, empty states, and error states.
- [x] Build the first dashboard screen with queue summary cards and recent activity.
- [x] Build proposal queue/detail flows using `list_agent_proposals`, `get_agent_proposal`, and linked `get_journal_entry_draft`.
- [x] Build approval queue/detail flows using `list_approval_requests`, `list_assigned_approval_requests`, `get_approval_request`, `resolve_approval_request`, and `escalate_approval_request`.
- [x] Build posted-entry list/detail flows using `list_journal_entries`, `get_journal_entry`, and linked audit navigation.
- [x] Build audit timeline review using `get_entity_timeline`.
- [x] Add automated web tests for API client handling, session bootstrap behavior, and at least one queue/detail render path.
- [x] Update the OSS-facing docs once the first operator-console slice is in place.
- [x] Add a minimal production build/deploy path for `apps/web` so the operator console can be served on `accounting.nexiuslabs.com` without disturbing the live API deployment.
- [x] Extend the VPS deployment docs and Caddy examples to cover the split-domain setup: `accounting.nexiuslabs.com` for web and `api.nexiuslabs.com` for the API.
- [x] Add a Netlify deployment path for `apps/web` so the static operator console can be hosted separately from the VPS while keeping `api.nexiuslabs.com` as the backend origin.
