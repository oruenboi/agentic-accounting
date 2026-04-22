---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# Agent Proposals 01

## Purpose
Define the proposal layer that sits between agent intent and accounting mutation.

The proposal layer exists so that agents can:
- gather context
- prepare suggested actions
- persist those suggestions
- route them for review or approval

without directly mutating the ledger by default.

## Why A Proposal Layer Is Needed
OpenClaw and similar agents are useful for:
- drafting journals
- matching schedules
- suggesting reconciliations
- explaining variances

But they should not be treated as unrestricted posting actors.

The proposal layer allows:
- reviewability
- approval routing
- repeatability
- auditability
- structured escalation

## Design Principles

### 1. Proposal Is Not Posting
A proposal is a candidate action, not a committed accounting outcome.

### 2. Proposal Must Be Durable
Agent suggestions cannot live only in chat or transient runtime state. They need a stored record.

### 3. Proposal Must Be Reviewable
A human reviewer must be able to inspect:
- what the agent proposed
- why it proposed it
- what data it used
- what the accounting impact would be

### 4. Proposal Must Be Linkable
A proposal should link cleanly to:
- backend request IDs
- approval requests
- resulting drafts or posted entities
- audit logs
- OpenClaw run/tool context

## Proposal Types

Recommended initial categories:
- `journal_entry`
- `reversal`
- `schedule_reconciliation`
- `report_explanation`
- `variance_explanation`
- `close_adjustment`

Not every proposal type leads to a posting, but the model should support both analytical and mutating suggestions.

## Recommended Table: `agent_proposals`

Suggested fields:

- `id uuid pk`
- `firm_id uuid not null`
- `organization_id uuid not null`
- `proposal_type text not null`
- `status text not null`
- `title text not null`
- `summary text null`
- `agent_name text not null`
- `agent_run_id text null`
- `tool_name text null`
- `tool_call_id text null`
- `request_id text null`
- `correlation_id text null`
- `idempotency_key text null`
- `actor_type text not null default 'agent'`
- `actor_id text not null`
- `confidence_score numeric(5,4) null`
- `risk_level text not null default 'normal'`
- `target_entity_type text null`
- `target_entity_id text null`
- `proposal_payload jsonb not null`
- `supporting_context jsonb not null default '{}'::jsonb`
- `impact_preview jsonb not null default '{}'::jsonb`
- `validation_result jsonb not null default '{}'::jsonb`
- `approval_request_id uuid null`
- `reviewed_by_user_id uuid null`
- `reviewed_at timestamptz null`
- `review_notes text null`
- `resolution_reason text null`
- `resolved_entity_type text null`
- `resolved_entity_id text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

## Recommended Status Values

- `draft`
- `ready_for_review`
- `pending_approval`
- `approved`
- `rejected`
- `accepted`
- `superseded`
- `cancelled`

Meaning:
- `draft`: proposal record exists but is not ready for human review
- `ready_for_review`: proposal is complete enough for review
- `pending_approval`: approval workflow has been triggered
- `approved`: approval granted but action may not yet be committed
- `rejected`: human or policy rejected it
- `accepted`: proposal has been converted into the next authoritative entity
- `superseded`: replaced by a better/newer proposal
- `cancelled`: intentionally withdrawn

## Payload Structure

### `proposal_payload`
This stores the concrete suggested action.

Examples:

#### Journal Entry Proposal
```json
{
  "entry_date": "2026-03-31",
  "memo": "Utilities accrual",
  "lines": [
    { "account_id": "acc_exp_utilities", "debit": "1000.00", "credit": "0.00" },
    { "account_id": "acc_accrued_expenses", "debit": "0.00", "credit": "1000.00" }
  ]
}
```

#### Schedule Reconciliation Proposal
```json
{
  "schedule_type": "accounts_receivable",
  "as_of_date": "2026-03-31",
  "action": "mark_reconciled",
  "notes": "Schedule ties to GL and AR aging."
}
```

### `supporting_context`
This stores the evidence or context the agent used.

Examples:
- source report references
- source schedule run IDs
- matched documents
- bank transaction IDs
- prompt context summary

### `impact_preview`
This stores what would happen if accepted.

Examples:
- affected accounts
- total debit / credit
- resulting variance reduction
- whether approval is required

## Proposal Lifecycle

### Step 1: Agent Reads Context
Agent gathers:
- tenant
- relevant reports or schedules
- candidate accounts
- unmatched or anomalous items

### Step 2: Agent Builds Proposal
Agent calls a proposal or validation tool and receives:
- structured validation
- impact preview
- warnings

### Step 3: Proposal Is Persisted
Backend stores a durable `agent_proposals` row with:
- context
- payload
- preview
- validation result

### Step 4: Proposal Is Reviewed
Human reviewer or policy engine determines:
- reject
- approve
- request modification
- accept and commit

### Step 5: Proposal Resolves To An Entity
The proposal may resolve into:
- `journal_entry_draft`
- `approval_request`
- `journal_entry`
- `schedule_reconciliation`

This linkage should be preserved through:
- `resolved_entity_type`
- `resolved_entity_id`

## Relationship To Approval Requests

Proposal and approval are not the same thing.

Recommended flow:
- a proposal exists first
- policy determines whether it requires approval
- if required, proposal links to `approval_request_id`
- after approval, proposal can be converted into a draft or committed result

This prevents approval records from existing without a concrete proposed action.

## Relationship To Journal Drafts

For journal-related proposals, there are two valid patterns:

### Pattern A: Proposal Before Draft
- agent proposal created
- human approves proposal
- backend creates journal draft or posted entry

### Pattern B: Proposal Wraps Draft
- backend creates draft first
- proposal references the draft as target
- proposal is the review envelope around the draft

### Recommendation
Use Pattern B for journal entries:
- create draft
- persist proposal linked to draft
- review or approve the proposal/draft pair

This keeps accounting payloads in the ledger-draft structure while preserving agent review state.

## Confidence and Risk

### `confidence_score`
Use for heuristic or matching proposals.

Examples:
- vendor match
- schedule variance explanation
- bank transaction classification

### `risk_level`
Recommended values:
- `low`
- `normal`
- `high`
- `critical`

Risk should be assigned from:
- account types touched
- amount thresholds
- prior-period impact
- tax/equity involvement

## OpenClaw Integration

OpenClaw should be treated as proposal initiator, not proposal storage.

The backend proposal record should capture:
- `agent_name`
- `agent_run_id`
- `tool_name`
- `tool_call_id`
- `request_id`
- `idempotency_key`

This allows correlation between:
- OpenClaw runs
- tool calls
- approvals
- resulting accounting entities

## API Implications

Recommended proposal-related tools or endpoints:

### Tools
- `create_journal_entry_draft`
- `validate_journal_entry`
- `create_agent_proposal`
- `get_agent_proposal`
- `list_agent_proposals`
- `accept_agent_proposal`
- `reject_agent_proposal`

### REST
- `POST /api/v1/agent-proposals`
- `GET /api/v1/agent-proposals`
- `GET /api/v1/agent-proposals/:proposalId`
- `POST /api/v1/agent-proposals/:proposalId/accept`
- `POST /api/v1/agent-proposals/:proposalId/reject`

## Auditing

Proposal lifecycle changes should write audit events such as:
- `agent.proposal.created`
- `agent.proposal.reviewed`
- `agent.proposal.approved`
- `agent.proposal.rejected`
- `agent.proposal.accepted`
- `agent.proposal.superseded`

## Acceptance Criteria
- Agent suggestions are persisted as durable proposal records
- Proposals preserve agent/run/tool/request identity
- Proposals can link to approval requests and resulting entities
- Reviewers can accept or reject without relying on chat history
- Journal-related proposals integrate cleanly with journal drafts
