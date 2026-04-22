---
owner: Codex
status: in_progress
last_reviewed: 2026-04-06
---

# Agent Proposal Schema 01

## Purpose
Define the implementation-facing schema for durable agent proposals that sit between agent intent and accounting mutation.

## Design Principles
- Agent proposals are persistent workflow objects, not transient chat messages.
- A proposal may be reviewed, approved, rejected, superseded, or converted into a posted accounting record.
- Proposals must preserve the source agent context, confidence signals, and linked evidence.
- Approval linkage and audit linkage must be explicit.

## Core Table

### `agent_proposals`
Suggested columns:
- `id uuid primary key default gen_random_uuid()`
- `firm_id uuid not null`
- `organization_id uuid not null`
- `proposal_type text not null`
- `status text not null`
- `title text not null`
- `description text null`
- `source_agent_name text null`
- `source_agent_run_id text null`
- `source_tool_name text null`
- `source_request_id text null`
- `correlation_id text null`
- `idempotency_key text null`
- `confidence numeric(5,4) null`
- `disambiguation_required boolean not null default false`
- `disambiguation_notes text null`
- `target_entity_type text null`
- `target_entity_id uuid null`
- `approval_request_id uuid null`
- `posted_entity_type text null`
- `posted_entity_id uuid null`
- `payload jsonb not null default '{}'::jsonb`
- `metadata jsonb not null default '{}'::jsonb`
- `created_by_actor_type text not null`
- `created_by_actor_id text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `resolved_at timestamptz null`
- `resolved_by_user_id uuid null`

## Status Values
Recommended values:
- `draft`
- `proposed`
- `needs_review`
- `approved`
- `rejected`
- `posted`
- `superseded`
- `cancelled`

Rules:
- `draft` may be edited by the originating agent flow or backend workflow.
- `proposed` means the proposal is ready for review.
- `needs_review` means there is ambiguity, low confidence, or policy gating.
- `approved` means a human or authorized workflow approved the proposal.
- `posted` means the proposal resulted in a ledger mutation or equivalent persisted outcome.
- `superseded` means a later proposal replaced it.
- `cancelled` means the proposal was abandoned without posting.

## Index Strategy
Recommended indexes:
- `(organization_id, status, created_at desc)`
- `(source_agent_run_id)`
- `(source_tool_name, created_at desc)`
- `(approval_request_id)`
- `(target_entity_type, target_entity_id)`
- `(posted_entity_type, posted_entity_id)`

These support:
- proposal queues
- agent run inspection
- approval traceability
- lineage from proposal to posted result

## Confidence And Disambiguation
The schema should support ambiguous agent outcomes explicitly.

Recommended fields:
- `confidence`
- `disambiguation_required`
- `disambiguation_notes`

Use cases:
- ambiguous vendor or customer matching
- uncertain schedule support
- multiple possible target accounts
- low-confidence posting suggestions

Rules:
- low confidence should not silently auto-post
- proposals requiring disambiguation should move into reviewable states

## Relationship To Approvals
If a proposal needs approval:
- create or link `approval_requests`
- persist `approval_request_id`
- do not post until approval is granted

The approval record should be the durable control gate, not the proposal alone.

## Relationship To Ledger
Not every proposal becomes a ledger posting.

Possible outcomes:
- proposal becomes a draft journal entry
- proposal becomes a schedule adjustment recommendation
- proposal becomes an exception or task
- proposal is rejected

If a proposal does become a posted entry, store:
- resulting posted entity type
- resulting posted entity ID

## Relationship To Audit
Proposal creation, review, approval, supersession, and posting should all be audited.

Audit should capture:
- source agent identity
- tool name
- request ID
- correlation ID
- confidence and disambiguation state

## Workflow Usage
Application services should use proposals for:
- journal suggestions
- reconciliation suggestions
- schedule adjustments
- close-precheck outputs
- ambiguous matching outcomes

This gives the platform a durable middle layer between agent reasoning and accounting truth.

## Dependencies
- API auth/client model
- approval behavior
- audit model
- application logic layering
- ledger posting engine
- idempotency design

## Acceptance Criteria
- Agent proposals are stored durably with tenant and agent provenance.
- Proposal state transitions are explicit.
- Approval and posting linkage are represented directly in the schema.
- Confidence and disambiguation are captured for ambiguous agent outputs.
