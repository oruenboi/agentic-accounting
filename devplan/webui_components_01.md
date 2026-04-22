---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Web UI Components 01

## Purpose
Define the reusable component and interaction model for the accounting operations console. This spec focuses on shared UI building blocks, screen states, and how agent assistance should appear in the interface.

## Design Principles
- Prefer reusable components over page-specific one-offs.
- Tables and queues are first-class UI primitives.
- Dense information should remain readable and action-oriented.
- Loading, empty, and error states must be explicit and helpful.
- Agent output should be clearly labeled and visually distinct from human-entered content.

## Core Layout Components

### App shell
Purpose:
- provides persistent navigation and context

Should include:
- top bar
- side navigation
- organization switcher
- period selector
- user menu
- notifications / work counter

### Page header
Purpose:
- orient the user within a screen

Should include:
- title
- subtitle or summary
- primary action
- secondary actions
- context badges for organization and period

### Detail drawer / inspector
Purpose:
- preserve queue context while drilling into an item

Use for:
- approval detail
- schedule run detail
- task detail
- audit timeline
- journal draft review

## Data Display Components

### Queue table
Purpose:
- show prioritized work items

Should support:
- status badges
- sort/filter
- assignee
- due date
- row-level actions
- quick open drawer

### Journal lines table
Purpose:
- display debit and credit lines in a legible accounting format

Should support:
- account code and name
- debit and credit columns
- running totals
- line notes
- attachment or support indicators

### Approval card
Purpose:
- summarize a reviewable control action

Should show:
- target entity
- amount or impact summary
- why approval is required
- linked evidence
- approve / reject / request follow-up

### Report table
Purpose:
- render canonical reporting outputs

Should support:
- grouped totals
- drill-down links
- export actions
- period metadata
- lineage indicators

### Schedule summary card
Purpose:
- show a schedule at a glance

Should include:
- schedule type
- as-of date
- GL balance
- schedule total
- variance
- review state

### Variance banner
Purpose:
- surface mismatch or exception conditions prominently

Should show:
- variance amount
- severity
- explanation
- next action

### Audit timeline
Purpose:
- present chronological events for an entity or period

Should show:
- event name
- actor
- timestamp
- status
- expandable metadata
- related entity links

### Attachment panel
Purpose:
- surface supporting documents and evidence

Should show:
- file name
- category
- uploader
- timestamp
- link purpose
- open/download action

## Screen State Components

### Loading state
Should indicate:
- what is loading
- whether the user can continue working elsewhere
- whether the load is partial or full-screen blocking

### Empty state
Should indicate:
- why there is no data
- what the user can do next
- whether a filter or context is limiting results

### Error state
Should indicate:
- what failed
- whether retry is possible
- whether the user lacks permission
- whether the system is unavailable

### Warning state
Should indicate:
- blocked close items
- unresolved variances
- expired approvals
- incomplete evidence

## Interaction Patterns

### Queue-to-detail
Common pattern:
1. user opens queue
2. selects row
3. detail opens in drawer or route
4. user performs action
5. queue updates without losing context

### Validate-before-commit
For accounting mutations:
1. draft is created
2. validation result is shown
3. approval requirement is shown
4. commit action is only exposed when allowed

### Explain-first actions
The UI should often present:
- why blocked
- why approval is needed
- why variance exists
- what evidence is missing

This is especially important for agent-generated items.

## Agent Presentation Rules
- label agent-generated content clearly
- distinguish proposals from final posted records
- show confidence or ambiguity when appropriate
- make human approval explicit and persistent
- avoid implying that agent-generated content is final until it is actually posted or approved

## Shared Status Vocabulary
Recommended status labels:
- `open`
- `in_progress`
- `blocked`
- `pending_approval`
- `approved`
- `posted`
- `reconciled`
- `variance_detected`
- `closed`
- `failed`

These should appear consistently across queues, details, and audit views.

## Accessibility And Density
- support keyboard navigation
- keep tables scannable
- preserve readable contrast for status labels
- ensure drawers and dialogs trap focus correctly
- avoid unnecessary visual clutter

## Responsive Behavior
- desktop should be the primary optimized view
- mobile should collapse navigation and simplify queue presentation
- critical review actions should remain reachable on smaller screens

## Non-Goals For V1
- highly animated consumer-style UI
- custom dashboard builder
- arbitrary end-user theming

## Dependencies
- route map
- role visibility
- audit read model
- user and agent flow
- reporting and schedule screens

## Acceptance Criteria
- The UI has a documented reusable component set for queues, details, approvals, reports, schedules, audit, and attachments.
- Loading, empty, error, and warning states are part of the design, not an afterthought.
- Agent assistance is visually distinct from human-entered content.
- The component model is detailed enough to guide React implementation without inventing new page-specific primitives later.
