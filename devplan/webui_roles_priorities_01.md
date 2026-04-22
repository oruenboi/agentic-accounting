---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Web UI Roles And Priorities 01

## Purpose
Define which roles can see which parts of the Web UI and establish the recommended screen priorities for the first release of the accounting operations console.

## Design Principles
- Visibility should follow accounting responsibility, not just login status.
- Client-facing users should see less than firm operators by default.
- Agent assistance should be visible, but humans retain decision control for material actions.
- The UI should prioritize control surfaces over cosmetic dashboards.
- Desktop workflows are primary; mobile support should remain usable but secondary.

## Role Model
Suggested roles:
- `firm_admin`
- `reviewer`
- `accountant`
- `bookkeeper`
- `client_viewer`
- `agent_operator`

These are UI-facing roles and should align with backend permissions.

## Screen Visibility

### `firm_admin`
Can access:
- Dashboard
- Tasks
- Approvals
- Ledger
- Reports
- Schedules
- Close
- Audit
- Settings

### `reviewer`
Can access:
- Dashboard
- Tasks
- Approvals
- Reports
- Schedules
- Close
- Audit
- limited Ledger views as needed

### `accountant`
Can access:
- Dashboard
- Tasks
- Ledger drafts
- Reports
- Schedules
- Audit
- limited Approvals

### `bookkeeper`
Can access:
- Dashboard
- Tasks
- Ledger drafts
- Reports
- Schedules
- limited Audit

### `client_viewer`
Can access:
- Dashboard
- Reports
- selected Schedules
- read-only Audit summaries if allowed

### `agent_operator`
Can access:
- agent proposals
- task queues
- approval-support views
- audit and lineage views needed for assistance

## Action Restrictions

### Material actions requiring elevated review
- posting journals
- reversing posted entries
- closing periods
- reopening periods
- accepting schedule variances

### Typically read-only for client viewers
- approvals
- ledger posting actions
- close actions
- task reassignment

### Agent-related restrictions
- agents may propose
- agents may explain
- agents may prepare drafts
- agents should not finalize material actions without approval or explicit policy support

## Screen Priority for V1

### P0 screens
1. Dashboard
2. Approvals
3. Ledger drafts and posted entries
4. Reports
5. Schedules
6. Close
7. Audit

### P1 screens
1. Tasks
2. Settings
3. Organization management
4. Attachment views
5. Agent proposal detail surfaces

### P2 screens
1. Advanced comparisons
2. Optional analytics views
3. Client-oriented read portals

## Build Order Recommendation
1. App shell and context selector
2. Dashboard
3. Approvals
4. Ledger draft and posting views
5. Reports
6. Schedules
7. Close
8. Audit
9. Tasks
10. Settings

This order keeps the console focused on the highest-control surfaces first.

## Role-Based UI Rules
- unauthorized screens should be hidden, not just disabled
- destructive or material actions should require a clear permission gate
- agent-originated items should be labeled in the UI
- client viewers should never see controls that imply write access if they cannot use them

## Mobile and Desktop Priorities

### Desktop
Primary target.
- dense tables
- split panes
- drawers
- fast keyboard navigation

### Mobile / narrow view
Secondary support.
- stacked layouts
- limited queue review
- read-only access to summaries and detail where possible

## Permission-to-Screen Mapping

### Dashboard
All roles except possibly very limited system roles.

### Approvals
Reviewers, firm admins, accountants with approval permissions.

### Ledger
Accountants, reviewers, firm admins, and bookkeepers with limited scopes.

### Reports
Most roles, with variation in available detail.

### Schedules
Reviewers, accountants, firm admins, bookkeepers.

### Close
Primarily reviewers and firm admins, with preparer support for accountants.

### Audit
Reviewers, firm admins, accountants, and selected client viewers.

### Settings
Firm admins only, with narrow sub-permissions for member management and org configuration.

## Agent Visibility
Agent-assisted state should be visible to:
- reviewers
- accountants
- firm admins
- agent operators

The UI should show:
- proposed by agent
- awaiting approval
- approved by human
- rejected by human
- auto-allowed by policy

## Non-Goals For V1
- making every screen available to every role
- overexposing internal workflow state to client viewers
- mobile-first redesign
- consumer self-serve navigation patterns

## Dependencies
- webui routes
- webui components
- approval behavior
- API auth and client model
- agent flow

## Acceptance Criteria
- Screen visibility is defined by role and responsibility.
- The first-release screen priority order is explicit.
- High-control workflows appear before optional or decorative views.
- Agent and human responsibilities are visually and permission-wise distinct.
