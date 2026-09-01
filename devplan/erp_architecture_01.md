---
owner: Codex
status: in_progress
last_reviewed: 2026-05-08
---

# ERP Architecture 01

## Purpose
Define how Agentic Accounting should expand into ERP modules without weakening the existing accounting control plane.

The ERP direction is to support both:
- accounting-firm operations
- client-organization operations

from the same tenant-aware platform.

## Position
ERP modules should be added as operational subledgers inside the existing modular monolith.

They should not become separate accounting systems of record.

The current accounting platform remains responsible for:
- tenant isolation
- accounting periods
- chart of accounts
- journal drafts
- immutable posted journal entries
- reversals
- approvals
- audit logs
- reporting
- idempotency
- agent-safe execution

ERP modules own operational records and workflows. They feed accounting through controlled posting intents and the ledger posting engine.

## Design Principles

### 1. Accounting Truth Stays In The Ledger
ERP documents may represent commercial reality, but financial reporting must still come from posted ledger data.

Examples:
- sales invoices are operational receivables records
- purchase bills are operational payables records
- inventory movements are operational stock records
- payroll imports are operational payroll evidence

They affect accounting only after they create ledger drafts or posted journal entries through the approved posting path.

### 2. ERP Modules Are Tenant-Scoped
Every ERP record owned by a client company must include:
- `firm_id`
- `organization_id`

This preserves the current hard tenant boundary around `organization`.

Firm-level templates may exist, but operational records belong to an organization.

### 3. Modules Share Platform Controls
ERP modules should reuse the existing control layers:
- Supabase-backed authentication
- `TenantAccessService`
- role and membership checks
- idempotency keys for mutating operations
- approval requests and approval actions
- audit logs
- agent proposals
- ledger posting engine

No ERP module should implement a private approval, audit, or posting path.

### 4. Modular Monolith First
The first ERP expansion should stay inside the current monorepo shape:

```text
apps/
  api/
  web/
infra/
  supabase/
devplan/
```

Recommended first implementation shape:
- NestJS modules under `apps/api/src/modules`
- React routes and API helpers under `apps/web/src`
- timestamp-prefixed SQL migrations under `infra/supabase/migrations`

Separate services are deferred until operational scale justifies the split.

### 5. Firm And Client Use Cases Must Coexist
The same module should support:
- internal firm staff operating on behalf of clients
- client users reviewing or performing allowed actions
- agents assisting with drafting, matching, summarization, and explanation

Role and permission differences should be expressed through access policy, not by duplicating modules.

## ERP Module Categories

### Foundation
- module registry
- parties
- party roles
- items
- documents
- numbering sequences
- posting profiles
- business events
- posting intents
- module permissions

### Finance Operations
- sales invoices
- credit notes
- receipts
- vendor bills
- debit notes
- payments
- AR aging
- AP aging

### Work And Firm Operations
- CRM
- projects or engagements
- tasks
- time entries
- expenses
- firm billing

### Procurement And Inventory
- purchase requisitions
- purchase orders
- goods receipts
- inventory items
- warehouses or locations
- stock movements
- inventory adjustments
- inventory valuation

### People And Assets
- employee records
- payroll summary imports
- expense claims
- fixed asset register
- depreciation
- disposals

### Banking, Tax, And Close
- bank statement import
- matching and reconciliation
- tax codes
- tax reports
- close packs
- evidence review

## Runtime Boundaries

### ERP Records
ERP records are the operational source for module workflows.

Examples:
- invoice header and lines
- purchase bill header and lines
- stock movement
- time entry
- fixed asset

These records should be mutable only according to their own state machine.

### Business Events
Business events record that an operational event occurred.

Examples:
- invoice issued
- bill approved
- payment received
- stock adjustment approved
- depreciation run generated

Business events are durable and auditable.

### Posting Intents
Posting intents are the bridge between ERP operations and accounting.

They normalize a business event into accounting impact before a journal draft or posted entry is created.

### Ledger Entries
Ledger entries are accounting truth.

Only the ledger posting engine should create posted entries and lines.

## API Direction
ERP REST APIs should use the current API style:
- `/api/v1/<domain>`
- Supabase bearer auth
- explicit `organization_id`
- common response envelope
- idempotency on mutating operations
- service-layer tenant checks

Agent tools should be added only after the corresponding REST/service workflow is stable.

## UI Direction
The operator console should expand from accounting review into ERP operations.

Recommended navigation groups:
- Operations
- Sales
- Purchasing
- Documents
- Inventory
- Projects
- People
- Accounting
- Audit
- Settings

Client-facing views can reuse the same module surfaces with stricter permissions and narrower route visibility.

## Non-Goals For First ERP Expansion
- replacing the accounting ledger with module ledgers
- separate microservices per ERP module
- live bank, payroll, tax, or payment provider connectors
- full statutory payroll calculation
- manufacturing or MRP in the first module wave
- arbitrary low-code ERP customization

## Dependencies
- ledger posting engine
- approval behavior
- auditability strategy
- idempotency design
- API auth and client model
- storage blueprint
- user and agent flow

## Acceptance Criteria
- ERP modules are documented as operational subledgers.
- The accounting ledger remains the only financial source of truth.
- ERP records are tenant-scoped by `firm_id` and `organization_id`.
- ERP modules reuse existing approval, audit, idempotency, and ledger controls.
- The architecture supports both firm-operated and client-operated workflows without duplicating module implementations.
