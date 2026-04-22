---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Web UI Routes 01

## Purpose
Define the page map and route structure for the accounting operations console. The UI should support multi-organization operations, review queues, approvals, reporting, schedules, close management, and audit investigation.

## Design Principles
- The route structure should reflect operational work, not generic product marketing.
- Context such as organization and accounting period should be globally visible.
- Deep drill-down should be possible without losing queue context.
- Every route should have a clear purpose, not duplicate screens with slightly different names.

## App Shell Routes

### `/`
Dashboard landing page.

Purpose:
- show what needs attention now
- summarize organizational context
- route into the highest-priority work

### `/org/:organizationId`
Organization-scoped landing page.

Purpose:
- resolve the active client/company context
- show queue summaries, schedules, and reports for the selected organization

### `/org/:organizationId/period/:periodId`
Period-scoped landing page.

Purpose:
- show close and accounting-period progress
- surface blockers, reconciliations, and signoff state

## Primary Navigation Routes

### Dashboard
- `/dashboard`

Contains:
- high-level metrics
- open tasks
- pending approvals
- schedule variances
- close blockers
- recent agent proposals

### Tasks
- `/tasks`
- `/tasks/:taskId`

Contains:
- task queues
- task detail
- assignment and completion controls
- links to related entities

### Approvals
- `/approvals`
- `/approvals/:approvalId`

Contains:
- approval queue
- approval detail
- linked documents
- approve/reject actions
- approval history timeline

### Ledger
- `/ledger`
- `/ledger/drafts`
- `/ledger/drafts/:draftId`
- `/ledger/entries`
- `/ledger/entries/:entryId`

Contains:
- draft journal list
- draft detail and validation
- posted journal explorer
- reversal entry detail
- audit links

### Reports
- `/reports`
- `/reports/trial-balance`
- `/reports/balance-sheet`
- `/reports/profit-and-loss`
- `/reports/general-ledger`
- `/reports/:reportType/:runId`

Contains:
- report landing page
- canonical financial reports
- export actions
- drill-down into source entries

### Schedules
- `/schedules`
- `/schedules/:scheduleType`
- `/schedules/:scheduleType/:runId`

Contains:
- schedule list by type
- schedule generation status
- schedule detail
- variance review
- support document links

### Close
- `/close`
- `/close/:periodId`
- `/close/:periodId/checklist`
- `/close/:periodId/signoff`

Contains:
- close checklist overview
- blocker detail
- signoff state
- reopen history

### Audit
- `/audit`
- `/audit/:entityType/:entityId`
- `/audit/approvals/:approvalId`
- `/audit/agent-runs/:agentRunId`
- `/audit/period-evidence/:periodId`

Contains:
- entity timelines
- approval timelines
- agent run traces
- period evidence

### Settings
- `/settings`
- `/settings/members`
- `/settings/accounts`
- `/settings/organization`

Contains:
- access control
- account settings
- organization configuration

## Secondary and Nested Views

### Right-side drawers
Use drawers for:
- quick entity inspection
- attachments
- audit preview
- agent proposal preview

### Detail pages
Use full detail pages for:
- approval decisions
- posted entries
- close runs
- schedule runs
- audit timelines

### Nested views
Examples:
- `/ledger/drafts/:draftId/validate`
- `/schedules/:scheduleType/:runId/review`
- `/close/:periodId/blockers`

Nested routes should preserve the parent context and avoid full page reload-style disruption.

## Route Behavior Rules
- route changes should preserve selected organization and period where possible
- routes that depend on context should redirect to context selection if context is missing
- write actions should never land the user on an ambiguous blank state
- unsupported or unavailable routes should fail gracefully with a useful recovery path

## Route-to-Feature Mapping

### Dashboard
Best for:
- summary and triage

### Tasks and Approvals
Best for:
- queue-driven work

### Ledger
Best for:
- journal review and controlled mutation

### Reports and Schedules
Best for:
- accounting review and evidence

### Close
Best for:
- month-end and year-end control flow

### Audit
Best for:
- traceability and investigation

## Search and Context Routing
The top-level search should support:
- accounts
- journal entries
- approvals
- schedules
- tasks
- audit trails
- attachments

Search results should deep-link into the appropriate route with the correct context preserved.

## Mobile and Narrow Screen Behavior
The route structure should remain usable on narrower screens even though the product is desktop-first.

Recommended behavior:
- collapse sidebar navigation into a drawer
- keep primary context selectors accessible
- stack detail panels under the primary content on small widths

## Non-Goals For V1
- consumer-facing onboarding funnels
- public landing-page marketing routes
- arbitrary user-built dashboards
- chat-first routing replacing structured workflow views

## Dependencies
- webui component system
- role visibility model
- API auth and client model
- user/agent flow

## Acceptance Criteria
- The UI route map supports the operational needs of the accounting console.
- Every major work area has a dedicated, predictable route family.
- Context-sensitive routes are clearly defined.
- The route map is detailed enough to guide implementation without inventing new navigation patterns later.
