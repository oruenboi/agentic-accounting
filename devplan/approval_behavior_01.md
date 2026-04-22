---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Approval Behavior 01

## Purpose
Define the v1 approval behavior model for the accounting platform. This document covers routing, escalation, delegation, expiry, approval-required rules, relationships to tasks and exceptions, and the possible approval outcomes that the application and agent layers must respect.

## Design Principles
- Approval state is a first-class workflow concern, not a UI-only prompt.
- The accounting backend owns durable approval state.
- The host agent platform may surface and relay approvals, but it must not be the source of truth.
- Approval policy must be deterministic enough for automation, yet conservative enough for accounting controls.
- Approval actions should always be auditable.

## Core Concepts

### Approval request
A durable record representing a decision needed before a protected action can proceed.

Typical protected actions:
- posting a journal entry
- reversing a posted journal entry
- closing an accounting period
- accepting a non-zero schedule variance
- approving a high-risk agent proposal

### Approval action
An immutable history row recording a specific step in the approval lifecycle.

Examples:
- submitted
- approved
- rejected
- recalled
- expired

### Approval policy
The rules that determine whether an action is:
- allowed immediately
- allowed only after approval
- denied outright

### Approver
The user or role authorized to resolve an approval request.

### Delegation
The temporary or policy-driven reassignment of approval responsibility to another user or role.

### Expiry
The state where an approval request is no longer valid and must be resubmitted or regenerated.

## Approval-Required Rules
Approval is required whenever a proposed action exceeds configured policy thresholds or touches sensitive accounting areas.

V1 default approval-required cases:
- manual journal entry over threshold
- posting into a prior period
- entries touching tax payable or receivable
- entries touching equity accounts
- reversals of posted entries
- accepting a non-zero schedule variance
- closing or reopening an accounting period
- high-risk agent proposal commits

V1 default auto-allowed cases:
- draft creation
- validation
- read-only report requests
- schedule generation
- low-risk internal workflow updates

Policy should remain configurable per firm or organization, but the model should stay simple enough that a human reviewer can understand why an approval was requested.

## Routing Model

### Primary routing dimensions
Approval routing should consider:
- organization
- action type
- amount or materiality
- account sensitivity
- period status
- role availability
- escalation state

### Routing outcomes
An approval request may route to:
- a specific user
- a specific role queue
- a fallback reviewer
- a firm-level control owner

### Routing strategy
V1 routing should be deterministic and rule-based.

Recommended routing order:
1. organization-specific approver if configured
2. role-based queue for the matching action type
3. fallback reviewer role
4. firm-level escalation owner if no organizer-level approver is available

Routing should be visible in the approval request record so reviewers can understand why a request landed where it did.

## Escalation Model
Escalation is what happens when an approval remains unresolved beyond policy or SLA expectations.

Escalation triggers:
- approval request overdue
- approver unavailable
- request repeatedly bounced or reassigned
- close-critical approval still pending near period lock

Escalation paths:
- escalate to a higher-priority reviewer
- escalate to a firm-level reviewer
- create or raise a task in the workflow queue
- block period close until resolved

Escalation should not mutate the original accounting payload. It should only change who is responsible for the decision and how visible the item is in queues.

## Delegation Model
Delegation is a controlled handoff of approval responsibility.

Supported delegation forms:
- manual reassignment by an authorized user
- role-based reassignment when a queue owner is absent
- temporary delegation for leave or coverage

Delegation metadata should capture:
- original approver or queue
- new approver or queue
- delegated by
- delegated at
- reason
- expiry of the delegation itself if temporary

Delegation should be auditable and should not erase the original routing decision.

## Expiry Model
Approval requests should not remain pending forever.

Expiry reasons:
- SLA elapsed
- related entity changed materially
- underlying draft or proposal was superseded
- period was closed or reopened in a way that invalidated the approval
- request was explicitly recalled

Expiry outcomes:
- mark approval request as expired
- create a follow-up task if human attention is still needed
- require a fresh approval request for the updated action

The key rule is that expired approvals do not authorize stale actions.

## Relationship To Tasks
Approval requests and tasks are related but distinct.

Approval request:
- represents the decision itself
- has a target entity and a decision state
- resolves into approved or rejected

Task:
- represents work to be done
- can be assigned to a person or queue
- can be completed, blocked, or cancelled

Typical relationship:
- an approval request creates a review task
- the task helps route human attention
- the approval request remains the authoritative decision object

If a request is overdue, unresolved, or needs follow-up, a task may be created or escalated. The approval request should still remain the source of truth for the decision state.

## Relationship To Exceptions
Exceptions are control or reconciliation issues, not decisions.

Examples:
- schedule variance is non-zero
- required attachment is missing
- close blocker exists
- an approval was rejected and requires remediation

Relationships:
- an exception may create an approval request
- an approval request may resolve an exception
- unresolved exceptions may block approvals or close actions

Examples:
- a non-zero balance sheet schedule variance may require both an exception and an approval request if the variance is accepted rather than corrected
- a missing document exception may block approval until the document is attached

Exceptions should not be collapsed into approval records because they represent a different control layer.

## Approval Outcomes

### Allowed
The action can proceed without approval.

Use when:
- policy permits immediate execution
- the action is low risk

### Pending approval
The request has been created and awaits a decision.

Use when:
- the action is protected
- an approver or queue has been assigned

### Approved
The approval has been resolved positively.

Effect:
- the protected action may proceed if all other validations still pass
- the approval record remains immutable

### Rejected
The approval has been denied.

Effect:
- the protected action must not proceed
- the originating draft or proposal may remain for correction or review

### Expired
The approval is no longer valid.

Effect:
- a fresh approval request may be required
- the stale action should not be committed

### Recalled
The request was withdrawn before resolution.

Effect:
- useful when the draft or proposal changed materially
- should be auditable and distinct from rejection

## State Transitions
Recommended approval lifecycle:
- `pending`
- `approved`
- `rejected`
- `expired`
- `recalled`

State transition rules:
- `pending` may move to any final state
- `approved` and `rejected` are terminal
- `expired` is terminal
- `recalled` is terminal unless a new request is created

## Interaction With Agent Flows
Agents may:
- propose an action
- submit a request for approval
- poll or read approval state
- proceed only after approval is granted

Agents may not:
- fabricate approval outcomes
- bypass approval gates
- overwrite approval history

The accounting backend should be the authority that decides whether an agent action is eligible to commit after approval.

## Interaction With The Audit Model
Every approval lifecycle step should generate audit events and be visible in the audit read model.

Recommended audit events:
- `approval.request.created`
- `approval.request.submitted`
- `approval.request.routed`
- `approval.request.delegated`
- `approval.request.escalated`
- `approval.request.approved`
- `approval.request.rejected`
- `approval.request.expired`
- `approval.request.recalled`

The audit trail should show:
- actor
- request
- target entity
- decision reason
- policy snapshot if available

## Data Fields To Preserve
An approval request should preserve enough context to explain the decision later.

Suggested fields:
- organization
- action type
- target entity type and ID
- requestor
- current approver
- routing reason
- threshold or policy reference
- decision deadline
- final decision
- decision reason

## Operational Rules
- Approval requests must be immutable once resolved.
- Approval routing should be deterministic and explainable.
- Expiry should be explicit rather than implicit.
- Delegation should be recorded rather than silently reassigned.
- Close-critical approvals should block close until resolved or explicitly accepted under policy.

## Non-Goals For V1
- complex multi-stage approval graph engines
- parallel quorum approvals
- dynamic per-field approval matrices
- custom workflow designer UI

## Dependencies
- approval request header schema
- approval action history schema
- task and exception workflow
- audit read model
- agent proposal model

## Implementation Sequence
1. Add approval routing rules in the backend policy layer
2. Add task creation for pending approvals
3. Add escalation and delegation handling
4. Add expiry handling
5. Surface approval state in audit and queue views
6. Bind agent tool responses to approval outcomes

## Acceptance Criteria
- The document explains when approval is required and when it is not.
- The routing model is deterministic and explainable.
- Delegation, escalation, and expiry are distinct behaviors with clear outcomes.
- Tasks and exceptions relate to approvals without replacing them.
- Each approval outcome is explicit enough to guide backend behavior and UI states.
