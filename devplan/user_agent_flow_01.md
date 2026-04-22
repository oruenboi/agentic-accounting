---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# User And Agent Flow 01

## Purpose
Define the primary human and agent workflows for the accounting platform, including where responsibilities diverge, where they converge, and where approval and close controls interrupt the flow.

## Design Principles
- Humans and agents use different interfaces but the same controlled backend workflows.
- Agents prepare, analyze, and propose; humans approve, review, and sign off on material actions.
- The ledger, approval system, and audit system remain shared control layers across all flows.
- Workflow state must be explicit and visible.
- No flow should allow silent mutation of accounting truth.

## Shared Flow Model
Most flows follow the same pattern:
1. establish tenant context
2. gather current state
3. prepare draft or proposal
4. validate
5. evaluate approval policy
6. commit or escalate
7. audit and create follow-up workflow items
8. expose outcome in reporting and review views

This applies to both users and agents, though the surface actions differ.

## Flow 1: Journal Entry Draft To Posting

### Human flow
1. user selects client organization
2. user opens new adjustment journal flow
3. user enters draft lines and memo
4. system validates structure and balances
5. user submits draft
6. approval policy evaluates risk
7. if no approval required:
   - ledger posts the entry
8. if approval required:
   - approval request is created
   - reviewer task is created
9. reviewer approves or rejects
10. if approved, entry is posted
11. reports and audit views update

### Agent flow
1. agent receives goal such as "prepare accrual journal"
2. agent calls `create_journal_entry_draft`
3. agent calls `validate_journal_entry`
4. backend applies approval policy
5. if allowed:
   - agent may call `commit_journal_entry`
6. if approval required:
   - backend creates approval request
   - agent stops at proposal state
7. reviewer approves
8. user or agent completes commit path

### Control points
- tenant validation before draft creation
- double-entry validation before commit
- approval gate before posting if policy requires it
- audit events for draft, approval, posting

## Flow 2: Approval Review

### Human flow
1. reviewer opens approval queue
2. reviewer selects approval request
3. reviewer inspects:
   - target entity
   - accounting impact
   - support documents
   - agent or user origin
4. reviewer approves or rejects
5. system records approval action
6. linked workflow task resolves or updates

### Agent flow
1. agent may surface or summarize pending approvals
2. agent may explain impact or missing evidence
3. agent does not act as approval truth
4. if delegated review support is allowed, agent can help summarize but not finalize beyond policy

### Control points
- approval is durable in backend
- OpenClaw host prompts do not replace backend approval state
- approval outcome feeds downstream posting or rejection

## Flow 3: Balance Sheet Schedule Review

### Human flow
1. user opens balance sheet schedules for an organization and date
2. user reviews generated schedule status
3. if zero variance:
   - user reviews support
   - marks schedule reviewed or reconciled
4. if variance exists:
   - user inspects variance explanation
   - reviews linked support files
   - chooses one of:
     - propose correcting journal
     - accept with approval if policy allows
     - create/investigate exception
5. schedule status updates
6. related close checklist item moves forward or remains blocked

### Agent flow
1. agent calls `get_balance_sheet`
2. agent calls `get_balance_sheet_schedule`
3. agent detects zero or non-zero variance
4. if zero variance:
   - agent can summarize support and recommend review completion
5. if variance exists:
   - agent calls `explain_schedule_variance`
   - agent may create proposal for adjustment
   - agent may create exception/task if ambiguity remains
6. human reviewer decides next action

### Control points
- schedule total must reconcile to GL or remain exception-backed
- non-zero variance cannot silently pass close
- review completion is explicit

## Flow 4: Exception And Task Handling

### Human flow
1. user opens task queue or exception queue
2. user claims or is assigned an item
3. user investigates linked entity and evidence
4. user resolves issue, escalates, or marks blocked
5. system updates task/exception status and audit

### Agent flow
1. agent reads open tasks or exceptions
2. agent performs read/analysis tasks:
   - summarize issue
   - fetch linked entities
   - identify missing support
   - propose corrective draft
3. if issue is resolvable by proposal:
   - agent creates draft or recommendation
4. otherwise:
   - exception remains for human resolution

### Control points
- exceptions are not accounting mutations
- task completion does not imply ledger correction unless linked workflow finishes successfully

## Flow 5: Bank-Style Reconciliation / Matching
This is defined here as a workflow pattern even if the full bank module is not yet implemented.

### Human flow
1. user opens unreconciled transactions or reconciliation queue
2. system shows suggested matches or missing links
3. user confirms match, rejects suggestion, or creates adjustment
4. if adjustment required:
   - draft journal path begins
5. item becomes reconciled or remains exception-backed

### Agent flow
1. agent reads unreconciled items
2. agent proposes likely matches
3. if confidence is low:
   - create exception or disambiguation result
4. if confidence is high and policy allows:
   - prepare draft or reconciliation proposal
5. human confirms material or ambiguous cases

### Control points
- ambiguity should produce exception or review, not blind posting
- any ledger change still goes through posting engine and approval policy

## Flow 6: Period Close

### Human flow
1. preparer opens or creates close checklist run
2. user reviews checklist items:
   - approvals resolved
   - reports generated
   - schedules reviewed
   - critical exceptions resolved
3. unresolved blockers remain visible
4. preparer submits for signoff
5. reviewer inspects close evidence
6. reviewer approves close or sends back
7. authorized closer finalizes close
8. accounting period is locked or lock workflow is triggered

### Agent flow
1. agent runs close-precheck style reads
2. agent identifies blockers
3. agent generates schedules or reports where allowed
4. agent proposes corrective journals or workflow tasks
5. agent summarizes remaining blockers
6. human handles signoff and final close

### Control points
- close cannot proceed with unresolved critical blockers
- final signoff is human-controlled
- close and reopen actions are audited

## Human vs Agent Responsibility Split

### Agents should generally handle
- information gathering
- drafting
- validation assistance
- variance explanation
- matching suggestions
- evidence summarization
- queue triage support

### Humans should generally handle
- approval decisions
- material accounting judgment
- period close signoff
- acceptance of variances
- reopening periods
- high-risk reversals

This split is the default safety model for v1.

## Interface Surfaces

### Human interfaces
- internal web app
- dashboards
- queues
- detail pages for approvals, schedules, entries, and close runs

### Agent interfaces
- tool-style API
- OpenClaw plugin/runtime integration
- read, propose, and approval-gated commit actions

Different surfaces, same backend control model.

## State Handoff Points

Important handoffs:
- agent proposal -> human approval
- schedule variance -> exception/task
- approval granted -> posting allowed
- checklist complete -> signoff eligible
- close approved -> period lock

These handoffs should be visible in UI and audit history.

## Minimum Agent Safety Rules Across All Flows
- explicit `organization_id`
- authenticated client identity
- request and correlation IDs
- idempotent writes
- no direct posted-row writes
- approval gating where required
- full audit trace

## Non-Goals For V1
- fully autonomous close
- agent-only approval workflows
- silent auto-correction of material accounting issues

## Dependencies
- application logic layering
- approval behavior
- workflow/close model
- audit read model
- ledger posting engine
- API auth/client model
- OpenClaw integration design

## Acceptance Criteria
- The platform has a clear human and agent flow model for journals, approvals, schedules, exceptions, reconciliation-style review, and period close.
- Handoff points between agents and humans are explicit.
- The flow definitions reinforce the approval, audit, and posting controls already documented elsewhere.
- The document is detailed enough to guide future UI, API, and workflow implementation without inventing new ad hoc behavior.
