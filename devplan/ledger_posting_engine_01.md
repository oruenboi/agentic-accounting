---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Ledger Posting Engine 01

## Purpose
Define the behavioral model for the ledger posting engine that turns validated accounting intent into immutable posted double-entry records.

## Design Principles
- The ledger is the only source of accounting truth.
- All accounting workflows must post through one controlled posting engine.
- Posted entries are immutable.
- Corrections happen by reversal and reposting, not by editing posted rows.
- Every posted entry must remain balanced.
- Tenant consistency and period controls must be enforced before posting.

## Core Objects
- `journal_entry_drafts`
- `journal_entry_draft_lines`
- `journal_entries`
- `journal_entry_lines`
- `journal_entry_reversals`

The posting engine is the behavioral layer that governs how these objects move from draft to posted state.

## Double-Entry Model

### Entry structure
A posted journal entry must:
- belong to exactly one `organization_id`
- contain at least 2 lines
- have line amounts that are one-sided
- satisfy `sum(debit) = sum(credit)`

### Line rules
Each line must:
- reference exactly one account
- have non-negative debit and credit values
- have exactly one side populated with a non-zero amount

### Balance source of truth
Account balances are derived from posted journal lines.

The system must not use mutable account balance counters as the canonical accounting source.

## Posting Lifecycle

### 1. Draft creation
Drafts are mutable accounting proposals.

Used for:
- manual journals
- agent proposals
- workflow-generated adjustments

Draft state:
- `draft`

### 2. Validation
The posting engine validates the draft before submission or posting.

Validation state:
- `validated`

### 3. Approval evaluation
Approval policy decides whether posting may proceed immediately or must pause for approval.

Possible outcomes:
- allowed
- approval required
- denied

### 4. Posting
If allowed and valid, the engine creates immutable posted records:
- `journal_entries`
- `journal_entry_lines`

Posted state:
- `posted`

### 5. Reversal
If a posted entry is wrong, the engine creates a linked reversal entry instead of editing the original.

Reversal state:
- original entry marked effectively reversed by linkage
- reversal entry created as a new posted journal

## Draft State Machine
Recommended draft states:
- `draft`
- `validated`
- `pending_approval`
- `approved`
- `posted`
- `rejected`

Rules:
- only drafts can be edited
- posted state is terminal for the draft workflow
- rejected drafts are not posted unless explicitly reworked and resubmitted

## Validation Order
The posting engine should validate in a strict order.

### 1. Basic draft shape
- required fields present
- at least 2 lines
- valid amounts and date

### 2. Tenant consistency
- all referenced accounts belong to the same `organization_id` as the draft
- all linked supporting entities, if any, match the same tenant

### 3. Account validity
- referenced accounts exist
- accounts are active
- accounts are postable if parent/child account rules exist

### 4. Period validity
- target accounting period exists or the date is acceptable
- period is open for posting

### 5. Double-entry balance
- debit total equals credit total

### 6. Duplicate / replay safety
- request/idempotency checks pass
- source references are not being duplicated incorrectly

### 7. Approval policy
- determine whether posting can proceed

If any earlier step fails, later steps should not run.

## Posting Transaction Requirements
Posting must happen in one database transaction.

The posting transaction should:
- re-check draft validity
- re-check approval status if needed
- insert posted entry header
- insert posted lines
- update draft status or linkage
- write audit event(s)
- create follow-up workflow objects if required

This ensures the system does not end up with partial posts.

## Approval Interaction
The posting engine does not decide approval policy, but it must respect it.

Rules:
- if approval is required and not yet granted, do not post
- if approval is denied, do not post
- if approval expires, require revalidation or resubmission before posting

The engine should treat approval state as an input gate.

## Reversal Model

### Reversal purpose
Reverse an already posted journal without mutating history.

### Reversal behavior
The engine should:
- validate that reversal is allowed
- create a new posted entry with inverted debits and credits
- link reversal to original entry
- preserve audit and approval references

### Reversal controls
Reversal may require approval depending on policy.

Reversal should be blocked when:
- the reversal period is closed
- the entry is already reversed and duplicate reversal is disallowed
- policy denies the reversal

## Period Controls
The posting engine must enforce period status before creating posted rows.

Rules:
- drafts may exist for a date in a not-yet-closed period
- posting into a closed period must be blocked unless a specific reopen or override workflow exists
- reopening a period must be separately controlled and audited

This behavior should be enforced in application logic and, where practical, defended by DB checks.

## Org Consistency Rules
The posting engine must ensure:
- draft `organization_id` matches entry `organization_id`
- line accounts belong to the same organization
- linked approval request belongs to the same organization
- linked source entity belongs to the same organization where applicable

This is essential for multi-tenant correctness.

## Entry Numbering
Posted entries should receive organization-scoped sequence numbers.

Recommended behavior:
- allocate number at post time, not draft time
- keep numbering organization-local
- preserve numbering gaps according to chosen accounting policy if a transaction aborts after reservation

`organization_sequences` should support this behavior.

## Workflow Source Integration
Other modules should never write posted ledger rows directly.

Examples of callers:
- invoice workflow
- bill workflow
- payment workflow
- reconciliation workflow
- agent proposal workflow

Those modules should:
- construct accounting intent
- call posting engine validation and commit methods

They should not:
- edit posted balances
- insert posted lines directly

## Suggested Service Surface
Recommended backend service methods:
- `createDraftEntry()`
- `updateDraftEntry()`
- `validateDraftEntry()`
- `submitDraftEntry()`
- `commitDraftEntry()`
- `reversePostedEntry()`
- `getEntryLineage()`

Only `commitDraftEntry()` and `reversePostedEntry()` should create posted rows.

## Audit Requirements
Every important posting transition should create audit events.

Minimum event set:
- `ledger.journal_draft.created`
- `ledger.journal_draft.updated`
- `ledger.journal_draft.validated`
- `ledger.journal_draft.submitted_for_approval`
- `ledger.journal_entry.posted`
- `ledger.journal_entry.reversed`

Audit should include:
- actor identity
- request and correlation IDs
- approval reference
- original and resulting entity IDs

## Agent Interaction
Agents should use the posting engine through proposal and commit APIs.

Recommended pattern:
- create draft
- validate draft
- submit or commit based on policy

Agents should not bypass the draft lifecycle and write raw posted entries.

## Reporting Relationship
Reports consume only posted ledger data.

This means:
- drafts do not affect reports
- approval-pending drafts do not affect reports
- reversal entries affect reports through their own posted lines

The posting engine is therefore the boundary between workflow intent and reportable truth.

## Non-Goals For V1
- full subledger posting rules for every accounting document type
- multi-currency remeasurement logic
- cross-organization consolidated posting

## Dependencies
- ledger schema
- ledger DB guards
- approval behavior
- application logic layering
- idempotency design
- tenant/RBAC model

## Acceptance Criteria
- The posting engine lifecycle from draft to posted is clearly defined.
- Double-entry balance requirements are explicit at both draft-validation and posted-entry levels.
- Reversal behavior is defined without allowing in-place edits.
- Period and organization consistency checks are explicit.
- Other workflows are clearly required to post through the ledger engine rather than writing accounting truth directly.
