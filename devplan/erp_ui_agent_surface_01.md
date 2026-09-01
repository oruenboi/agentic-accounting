---
owner: Codex
status: in_progress
last_reviewed: 2026-05-08
---

# ERP UI And Agent Surface 01

## Purpose
Define the first UI and agent-facing surface for ERP modules.

This document extends the existing operator console and agent tool model without replacing the accounting review experience.

## UI Principles
- Keep accounting review surfaces authoritative.
- Add ERP modules as operational workspaces.
- Preserve organization and period context globally.
- Distinguish operational state from posted accounting state.
- Show posting status and approval status wherever an ERP document affects accounting.
- Support both firm operators and client users through role-based visibility.

## Navigation Groups
Recommended top-level groups:
- Dashboard
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

The existing accounting routes should remain available:
- proposals
- approvals
- ledger entries
- reports
- schedules
- close
- audit

## Phase 0 UI
Foundation screens:
- ERP module settings
- party list and detail
- item list and detail
- document inbox
- posting profile settings
- numbering settings
- module permission settings

These screens should be dense, table-oriented, and optimized for repeated operations.

## Phase 1 UI
Sales screens:
- customer list
- sales invoice queue
- invoice detail
- credit note queue
- receipt queue
- AR aging

Purchasing screens:
- vendor list
- purchase bill queue
- bill detail
- debit note queue
- payment queue
- AP aging

Document screens:
- document inbox
- document detail
- linked entity panel
- extraction status panel

Accounting link panels:
- posting intent status
- linked journal draft
- linked approval request
- linked posted journal entry
- audit timeline

## Later UI
Projects and firm operations:
- CRM pipeline
- project or engagement list
- task board or queue
- time entries
- expense claims
- firm billing workspace

Inventory and procurement:
- purchase orders
- goods receipts
- inventory items
- stock movements
- inventory valuation
- stock adjustment review

People and assets:
- employee list
- payroll import batches
- fixed asset register
- depreciation runs

Banking, tax, and close:
- bank statement imports
- matching queue
- tax code settings
- tax reports
- close pack evidence

## Client User Surface
Client users should see a narrower version of the same ERP modules.

Likely client-visible areas:
- document requests
- invoice and bill review
- approval tasks
- payment status
- project status
- selected reports

Client users should not see:
- cross-client firm dashboards
- internal firm task queues
- unrestricted ledger mutation tools
- posting profile configuration unless explicitly granted

## Agent Tool Principles
Agent tools should follow the same categories already used by the accounting tool surface:
- read
- proposal
- workflow
- commit

Expose read tools broadly within tenant scope.

Expose proposal tools for draft preparation and review support.

Expose commit tools only for stable workflows with idempotency, approval policy, and audit coverage.

## Recommended Agent Tool Groups

### Read Tools
- `list_parties`
- `get_party`
- `list_items`
- `get_item`
- `list_documents`
- `get_document`
- `list_sales_invoices`
- `get_sales_invoice`
- `list_purchase_bills`
- `get_purchase_bill`
- `get_ar_aging`
- `get_ap_aging`
- `list_posting_intents`
- `get_posting_intent`

### Proposal Tools
- `propose_party_merge`
- `classify_document`
- `prepare_sales_invoice`
- `prepare_purchase_bill`
- `suggest_payment_allocation`
- `suggest_posting_profile_mapping`
- `prepare_inventory_adjustment`
- `prepare_depreciation_run`

### Workflow Tools
- `submit_sales_invoice_for_approval`
- `submit_purchase_bill_for_approval`
- `submit_payment_for_approval`
- `submit_inventory_adjustment_for_approval`
- `submit_payroll_import_for_approval`

### Commit Tools
Commit tools should be introduced later and only for well-tested workflows.

Possible commit tools:
- `issue_sales_invoice`
- `approve_purchase_bill`
- `confirm_customer_receipt`
- `confirm_vendor_payment`
- `post_approved_erp_event`

Each commit tool must require:
- explicit `organization_id`
- idempotency key
- delegated user context for agent clients
- approval or policy allow result
- audit event output

## Tools To Avoid
Do not expose raw CRUD-style agent tools for accounting-impacting records.

Avoid tools like:
- `delete_invoice`
- `update_any_invoice_field`
- `set_posting_accounts`
- `force_post_document`
- `edit_posted_erp_event`

Use bounded workflow tools instead.

## Agent Output Requirements
ERP agent tool responses should preserve:
- source entity type and ID
- posting status
- approval status
- linked draft ID
- linked approval request ID
- linked journal entry ID
- warnings and validation errors
- human summary
- machine summary

## UI Acceptance Criteria
- ERP routes preserve active organization context.
- ERP documents show operational status and accounting status separately.
- Posting, approval, proposal, and audit links are visible from document detail screens.
- Client-visible UI can be restricted without duplicating module code.

## Agent Acceptance Criteria
- Agent tools follow read/proposal/workflow/commit classification.
- Accounting-impacting agent actions are idempotent and tenant-scoped.
- Commit tools do not bypass approval policy or the ledger posting engine.
- Agent responses expose enough linkage for audit and UI review.
