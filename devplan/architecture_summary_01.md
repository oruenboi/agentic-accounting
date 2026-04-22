---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# Architecture Summary 01

## Objective
Define the target backend architecture for a multi-tenant, agent-enabled accounting platform operated by an accounting firm.

## System Shape
The recommended target is a modular monorepo with:

- one accounting backend
- one internal operator web app
- one shared domain package
- one shared schemas/package-contract layer
- one Supabase/Postgres data layer

The system should be designed as a modular monolith, not microservices.

## Recommended Repository Layout

```text
apps/
  api/
  web/
packages/
  domain/
  schemas/
  sdk/
infra/
  supabase/
devplan/
```

## Core Runtime Components

### Backend
- NestJS application layer
- Supabase Postgres as canonical store
- Supabase Storage for documents and exports
- background job runner later as needed

### Frontend
- React-based internal operations UI
- primarily for review, approvals, schedules, and close workflows

### Agent Integration
- OpenClaw used as the orchestration shell
- accounting backend exposed through tool-style APIs
- backend remains source of truth for approval and audit records

## Architectural Principles

### 1. Ledger-Centric Design
Everything important eventually becomes journal entries.

Business workflows such as:
- invoices
- bills
- payments
- reconciliation
- depreciation

must terminate in balanced ledger postings.

### 2. Posted Records Are Immutable
Posted journal entries and lines are append-only in practice.

Corrections happen through:
- reversals
- replacement entries

never through silent in-place edits.

### 3. Tenant Isolation Is Fundamental
The hard tenant boundary is the client `organization`.

Each organization owns:
- chart of accounts
- periods
- journals
- reports
- schedules
- approvals
- documents

### 4. Human and Agent Flows Converge On The Same Backend
Humans and agents should not have separate accounting rule engines.

Both should flow through:
- validation
- approval policy
- posting engine
- audit trail

### 5. Approval And Audit Are Core Constraints
The product is not safe for accounting use unless every important change can be traced through:
- actor
- request
- approval
- resulting financial entity

## Main Backend Modules

### Tenant and Access
- firms
- organizations
- memberships
- RBAC and policy checks

### Ledger
- accounting periods
- accounts
- journal drafts
- posted journal entries
- reversals

### Approval and Control
- approval requests
- approval actions
- policy engine
- task and exception workflow

### Reporting
- trial balance
- balance sheet
- profit and loss
- general ledger
- schedule generation and reconciliation

### Audit
- audit logs
- report lineage later
- host/backend correlation later

## Storage Model

### Canonical Transactional Store
- Supabase Postgres

### Object Store
- Supabase Storage

### Read Models
- SQL views for canonical reports
- materialized views deferred until needed

### Workflow State
- Postgres tables for approvals, tasks, proposals, idempotency

## OpenClaw Role In The Architecture

OpenClaw is not the accounting system of record.

OpenClaw is responsible for:
- tool orchestration
- agent interaction
- optional approval UX bridge
- session/run context

The accounting backend is responsible for:
- financial truth
- posting validity
- durable approvals
- auditability
- tenant enforcement

## Recommended Delivery Sequence

1. core schema and controls
2. approval and idempotency
3. reporting and schedules
4. accounting plugin for OpenClaw
5. OpenClaw hardening for production use

## Current State
Already established:
- audit schema
- tenant schema
- ledger schema
- approval header
- base OpenClaw integration strategy

Still to implement:
- idempotency
- agent proposals
- reporting views
- schedule engine
- agent auth/tool execution model
