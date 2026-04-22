# Governance

## Purpose
This repository is an open-source accounting control plane for multi-company, approval-gated, agent-assisted workflows.

This document defines how the project is maintained, how decisions are made, how it relates to OpenClaw, and what is expected from security- or compliance-sensitive contributions.

## Maintainership Posture

The project is maintained with a pragmatic, control-oriented posture:

- correctness and auditability take priority over feature velocity
- accounting and workflow changes should be documented before implementation where practical
- public contributions are welcome, but changes that affect ledger integrity, approvals, auth, or tenant isolation require careful review
- release readiness is judged on the state of the documented architecture, tests, and operational guidance, not on aspirational feature lists

Maintainers are expected to keep the repository internally coherent across:

- planning docs
- schema migrations
- application services
- agent integration contracts
- release-facing documentation

## Decision Making

### Repository-level decisions
Decisions about the core accounting platform should be made by the maintainers of this repository.

This includes:

- data model changes
- ledger behavior
- approval behavior
- tenant and RBAC rules
- reporting and schedule semantics
- agent tool contracts
- packaging and release structure

### Change process
Changes should follow a planning-first approach:

1. capture the intended behavior in the planning docs
2. update the relevant design or implementation-spec document
3. implement the change
4. add or update tests
5. update the release-facing docs if user-visible behavior changes

### Review standard
Changes that affect accounting truth or control surfaces should be reviewed for:

- tenant isolation
- auditability
- idempotency
- approval gating
- rollback or reversal behavior
- compatibility with self-hosted and OpenClaw-integrated deployments

## Relationship To OpenClaw

This repository is not the OpenClaw codebase.

The intended relationship is:

- this repo owns the accounting platform
- OpenClaw owns the agent orchestration host
- the accounting plugin bridges the two
- any required OpenClaw host changes should be documented as external dependencies or maintained in a companion fork/upstream patch set

### Preferred OpenClaw strategy
The preferred long-term model is one of the following:

- a companion OpenClaw fork for host changes that are not yet upstreamed
- upstream contributions to OpenClaw where the changes are broadly useful
- a versioned compatibility statement that identifies the minimum OpenClaw host features required by this project

### Boundary rule
OpenClaw should not become the source of truth for:

- accounting approvals
- ledger postings
- tenant enforcement
- immutable audit history

Those controls belong in this repository's backend and database model.

## Licensing Guidance

The project should publish a clear license before a broad public release.

At the time this document was written, the final license choice is intentionally left open.

### Placeholder guidance
Until a final legal decision is made:

- do not assume a permissive license unless the repository explicitly states one
- do not copy third-party code into the repository without confirming compatibility
- do not promise dual-licensing, source-available, or commercial terms unless they are formally decided

### What the eventual license must support
The final license should be chosen with these goals in mind:

- enable public review of ledger and control logic
- allow self-hosting if that remains the intended product shape
- avoid ambiguity around derived works, redistribution, and commercial use
- remain compatible with any OpenClaw integration and its own licensing terms

### Legal note
This document is not legal advice and does not select the final license.
The repository should eventually include an explicit `LICENSE` file and, if needed, additional copyright or contributor notices.

## Security And Compliance-Sensitive Contributions

This project handles accounting data and therefore has a higher-than-average control burden.

Contributions in the following areas require extra care:

- authentication
- authorization
- tenant isolation
- approvals
- audit logs
- idempotency
- ledger posting
- reporting correctness
- document storage and retention
- OpenClaw agent execution paths

### Expectations for sensitive changes
Contributors should:

- describe the control impact in the change request or pull request
- update or add tests for the affected invariants
- avoid bypassing backend policy through UI or agent shortcuts
- avoid storing secrets, credentials, or compliance-sensitive data in plain text
- preserve the append-only nature of posted accounting records and audit history
- preserve or improve the ability to explain what happened after the fact

### Escalation rule
If a change could affect financial correctness, regulatory evidence, or tenant data isolation, it should be treated as a high-scrutiny change even if the code change is small.

## Contributions That Need Special Review

The following changes should not be merged casually:

- anything that touches posted ledger state
- anything that changes approval routing or approval defaults
- anything that alters RLS policies or membership checks
- anything that changes agent tool mutation permissions
- anything that changes retention, deletion, or archival behavior
- anything that modifies OpenClaw integration semantics

These should be reviewed with the expectation that a mistake can affect accounting truth or auditability.

## Practical Operating Rule

If a contribution changes how the system decides, stores, or explains money-related state, it should be accompanied by:

- an updated design doc if the behavior changes materially
- tests covering the new or changed invariant
- a clear statement of OpenClaw impact if relevant
- a note about license or third-party dependency compatibility if relevant

## Scope Of This Document

This document is intentionally light on formal process mechanics. It exists to set the project posture for:

- maintainership
- decision authority
- OpenClaw boundaries
- licensing placeholder guidance
- security and compliance review expectations

More specific contribution rules, release notes, or legal decisions may be added later as the project matures.
