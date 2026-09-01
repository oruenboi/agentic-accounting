---
owner: Codex
status: in_progress
last_reviewed: 2026-05-08
---

# ERP Module Roadmap 01

## Purpose
Define the phased rollout for adding ERP modules to Agentic Accounting.

The roadmap assumes:
- both accounting-firm and client-company ERP use cases matter
- the platform remains a modular monolith
- the accounting ledger remains the source of truth
- live third-party connectors are deferred until internal contracts are stable

## Rollout Strategy
Do not build all ERP modules at once.

Build the shared ERP foundation first, then add modules in waves that progressively increase accounting and operational complexity.

Each module wave should include:
- schema
- service layer
- REST APIs
- UI list/detail/review flows
- audit events
- idempotency behavior
- posting bridge integration where accounting impact exists
- focused tests

Agent tools should follow after the human/operator workflow is stable.

## Phase 0: ERP Foundation
Goal:
- create the reusable ERP platform layer.

Scope:
- module registry
- parties and party roles
- items
- documents and entity links
- numbering sequences
- posting profiles
- business events
- posting intents
- module permissions
- ERP dashboard shell

Acceptance:
- organizations can enable ERP modules
- parties can be created and assigned roles
- items can be created for services/products/inventory
- documents can be linked to ERP and accounting entities
- posting profiles can be configured
- business events can produce posting intents

## Phase 1: AR/AP, Documents, And Cash Basics
Goal:
- support the core accounting-firm workflow around sales, purchases, receipts, payments, and supporting evidence.

Sales scope:
- customers
- sales invoices
- sales invoice lines
- credit notes
- customer receipts
- invoice status tracking

Purchasing scope:
- vendors
- purchase bills
- purchase bill lines
- debit notes
- vendor payments
- bill status tracking

Document scope:
- source document inbox
- document-to-entity linking
- support evidence panels

Reports:
- AR aging
- AP aging
- open invoices
- open bills
- cash collection queue
- payment queue

Accounting integration:
- invoice issue
- credit note approval
- receipt confirmation
- bill approval
- payment confirmation

Acceptance:
- invoices and bills can generate posting intents
- configured low-risk events can auto-post through the ledger engine
- higher-risk events create approval-gated drafts or proposals
- AR/AP aging can tie back to operational records and ledger impact

## Phase 2: CRM, Projects, Time, And Firm Operations
Goal:
- support accounting-firm operating workflows and client service delivery.

CRM scope:
- leads
- prospects
- clients
- activities
- onboarding status

Projects scope:
- projects or engagements
- milestones
- tasks
- budgets
- owner assignment

Time and expense scope:
- time entries
- expense claims
- billable and non-billable flags
- approval workflow

Firm billing scope:
- convert approved time and expenses into sales invoices
- track WIP-like recoverables where needed

Accounting integration:
- reimbursable expenses
- firm billing
- deferred WIP or accrued revenue only if explicitly configured

Acceptance:
- firm staff can manage client work and generate billable activity
- approved billable activity can flow into invoicing
- accounting impact remains profile-driven and approval-aware

## Phase 3: Procurement And Inventory
Goal:
- add operational purchasing, receiving, stock tracking, and inventory accounting.

Procurement scope:
- purchase requisitions
- purchase orders
- purchase order lines
- approval states
- goods receipts
- three-way matching foundation

Inventory scope:
- inventory item settings
- warehouses or stock locations
- stock movements
- stock adjustments
- stock transfers
- inventory valuation

Default costing:
- weighted average costing for v1

Reports:
- stock on hand
- stock movement ledger
- inventory valuation
- reorder list
- PO status
- unmatched receipts or bills

Accounting integration:
- goods received not invoiced
- inventory asset
- cost of goods sold
- stock adjustment gains/losses
- purchase accruals

Acceptance:
- stock movements are operationally traceable
- inventory valuation can reconcile to GL
- adjustments and valuation changes are approval-gated unless explicitly low risk

## Phase 4: Fixed Assets, HR, And Payroll Summary
Goal:
- support higher-control accounting support areas without building a full payroll engine.

Fixed asset scope:
- asset register
- acquisition
- depreciation method
- depreciation runs
- disposal
- asset schedules

HR scope:
- employee records
- departments
- employment status
- basic assignment metadata

Payroll summary scope:
- payroll import batches
- payroll summary lines
- payroll journal review
- payment status

Accounting integration:
- asset acquisition
- depreciation
- disposal gain or loss
- payroll expense
- payroll liabilities
- payroll payments

Non-goal:
- full statutory payroll calculation in this phase.

Acceptance:
- asset register supports depreciation schedules
- payroll summaries can create reviewable journal drafts
- high-risk payroll and disposal events require approval

## Phase 5: Banking, Tax, And Advanced Close
Goal:
- strengthen reconciliation, compliance evidence, and period close support.

Banking scope:
- bank accounts
- statement imports
- transaction matching
- unmatched transaction queues
- bank reconciliation review

Tax scope:
- tax codes
- tax treatment on invoices and bills
- tax payable schedules
- tax reports

Close scope:
- close packs
- evidence completeness
- unresolved blocker dashboard
- ERP module close checks

Accounting integration:
- bank reconciliation adjustments
- tax payable/receivable postings
- close support schedules

Acceptance:
- bank and tax workflows are connector-ready
- imported data can be reconciled without bypassing approvals
- close view can surface ERP-derived blockers

## Phase 6: Advanced ERP Options
Goal:
- add broader ERP capabilities only after the core operational and accounting model is proven.

Possible scope:
- manufacturing or light MRP
- bills of materials
- work orders
- production consumption
- intercompany workflows
- multi-organization consolidation
- client portal
- live bank feeds
- payment provider integrations
- payroll system integrations
- tax filing integrations
- document OCR providers

Acceptance:
- each advanced module has a clear operational owner
- accounting impact still flows through posting intents
- connector contracts are stable before live integrations are added

## Build Order Recommendation
Recommended implementation order:
1. ERP foundation
2. AR/AP and documents
3. posting bridge hardening
4. projects/time/firm operations
5. procurement and inventory
6. fixed assets and payroll summary
7. banking, tax, and advanced close
8. optional advanced modules and connectors

## Risks
- Building too many modules before the posting bridge is stable will create inconsistent accounting behavior.
- Auto-posting without strict policy gates can undermine review controls.
- Inventory and payroll increase accounting complexity and should not be first.
- Live connectors can dominate scope before the internal ERP contracts are proven.

## Acceptance Criteria
- ERP module rollout is phased and implementation-oriented.
- Each phase identifies module scope and accounting integration points.
- First-wave work is bounded to foundation plus AR/AP/document workflows.
- More complex modules are sequenced after core posting and approval behavior is proven.
