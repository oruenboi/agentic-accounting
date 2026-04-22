---
owner: Codex
status: in_progress
last_reviewed: 2026-04-04
---

# API Spec V1 01

## Purpose
Define the concrete v1 API surface for the accounting backend, covering:

- endpoint list
- request and response shapes
- tool names
- error codes
- approval rules
- idempotency rules

## Base URLs

- REST/UI API: `/api/v1`
- Agent tool API: `/agent-tools/v1`

## Common Rules

### Authentication
All endpoints require bearer authentication.

### Tenant Scope
All accounting reads and writes must be explicitly scoped to an `organization_id`, either in request parameters or request body.

### Idempotency
All mutating requests must carry an idempotency key.

Recommended header:
- `X-Idempotency-Key`

### Common Success Envelope

```json
{
  "ok": true,
  "request_id": "req_01",
  "timestamp": "2026-04-04T10:00:00Z",
  "result": {}
}
```

### Common Error Envelope

```json
{
  "ok": false,
  "request_id": "req_01",
  "timestamp": "2026-04-04T10:00:00Z",
  "error": {
    "code": "ENTRY_NOT_BALANCED",
    "message": "Debits and credits do not match.",
    "details": {}
  }
}
```

## REST Endpoint List

### Organizations
- `GET /api/v1/organizations`
- `GET /api/v1/organizations/:organizationId`
- `GET /api/v1/organizations/:organizationId/members`

### Accounts
- `GET /api/v1/accounts?organization_id=...`
- `POST /api/v1/accounts`

### Journal Drafts
- `POST /api/v1/journal-entry-drafts`
- `GET /api/v1/journal-entry-drafts/:draftId`
- `POST /api/v1/journal-entry-drafts/:draftId/validate`
- `POST /api/v1/journal-entry-drafts/:draftId/submit`
- `POST /api/v1/journal-entry-drafts/:draftId/commit`

### Posted Journals
- `GET /api/v1/journal-entries?organization_id=...`
- `GET /api/v1/journal-entries/:journalEntryId`
- `POST /api/v1/journal-entries/:journalEntryId/reverse`

### Reports
- `GET /api/v1/reports/trial-balance`
- `GET /api/v1/reports/balance-sheet`
- `GET /api/v1/reports/profit-and-loss`
- `GET /api/v1/reports/general-ledger`

### Schedules
- `GET /api/v1/schedules/balance-sheet`
- `POST /api/v1/schedules/:scheduleRunId/reconcile`
- `POST /api/v1/schedules/:scheduleRunId/mark-reviewed`

### Approvals
- `GET /api/v1/approvals?organization_id=...&status=pending`
- `GET /api/v1/approvals/:approvalRequestId`
- `POST /api/v1/approvals/:approvalRequestId/approve`
- `POST /api/v1/approvals/:approvalRequestId/reject`

## Agent Tool Endpoints

- `GET /agent-tools/v1/schema`
- `GET /agent-tools/v1/tool/:toolName`
- `POST /agent-tools/v1/execute`
- `POST /agent-tools/v1/execute-batch`

## Tool Names

### Read Tools
- `get_organizations`
- `get_chart_of_accounts`
- `get_account_balance`
- `get_trial_balance`
- `get_balance_sheet`
- `get_profit_and_loss`
- `get_general_ledger`
- `get_balance_sheet_schedule`
- `list_unreconciled_schedule_accounts`
- `search_journal_entries`
- `get_approval_queue`

### Write / Proposal Tools
- `create_journal_entry_draft`
- `validate_journal_entry`
- `submit_journal_entry`
- `commit_journal_entry`
- `reverse_journal_entry`
- `reconcile_balance_sheet_schedule`
- `approve_request`
- `reject_request`

### Explanation Tools
- `explain_balance_change`
- `explain_schedule_variance`
- `get_report_lineage`

## Example Request Bodies

### Create Journal Draft

```json
{
  "organization_id": "org_123",
  "entry_date": "2026-03-31",
  "memo": "Accrual for utilities",
  "source_type": "manual_adjustment",
  "lines": [
    {
      "account_id": "acc_exp_utilities",
      "description": "Utilities accrual",
      "debit": "1000.00",
      "credit": "0.00"
    },
    {
      "account_id": "acc_accrued_expenses",
      "description": "Utilities accrual",
      "debit": "0.00",
      "credit": "1000.00"
    }
  ]
}
```

### Reversal Request

```json
{
  "organization_id": "org_123",
  "reversal_date": "2026-04-01",
  "reason": "Incorrect accrual amount"
}
```

### Schedule Reconcile Request

```json
{
  "organization_id": "org_123",
  "notes": "Reviewed against GL and schedule support."
}
```

### Agent Tool Execute Request

```json
{
  "tool": "get_balance_sheet_schedule",
  "input": {
    "organization_id": "org_123",
    "as_of_date": "2026-03-31",
    "schedule_type": "accounts_receivable"
  },
  "request_id": "agent_req_1"
}
```

## Example Response Shapes

### Journal Commit Posted

```json
{
  "ok": true,
  "request_id": "req_05",
  "timestamp": "2026-04-04T10:00:00Z",
  "result": {
    "journal_entry_id": "je_123",
    "entry_number": "JE-2026-000145",
    "status": "posted"
  }
}
```

### Journal Commit Requires Approval

```json
{
  "ok": true,
  "request_id": "req_05",
  "timestamp": "2026-04-04T10:00:00Z",
  "result": {
    "draft_id": "jed_123",
    "status": "pending_approval",
    "approval_request_id": "apr_123",
    "requires_approval": true
  }
}
```

### Agent Tool Result

```json
{
  "ok": true,
  "request_id": "agent_req_1",
  "timestamp": "2026-04-04T10:00:00Z",
  "result": {
    "schedule_run_id": "sch_123",
    "reconciled": true
  },
  "warnings": [],
  "errors": [],
  "requires_approval": false,
  "human_summary": "AR schedule ties to the GL.",
  "machine_summary": {
    "entity_type": "schedule_run",
    "entity_id": "sch_123",
    "status": "reconciled"
  }
}
```

## Error Codes

### Auth and Tenant
- `UNAUTHENTICATED`
- `INVALID_TOKEN`
- `TENANT_ACCESS_DENIED`
- `ORGANIZATION_NOT_FOUND`
- `INSUFFICIENT_PERMISSIONS`

### Validation
- `INVALID_REQUEST`
- `SCHEMA_VALIDATION_FAILED`
- `INVALID_DATE_RANGE`
- `INVALID_STATUS_TRANSITION`
- `MISSING_REQUIRED_FIELD`

### Accounting
- `ENTRY_NOT_BALANCED`
- `ACCOUNT_NOT_FOUND`
- `ACCOUNT_INACTIVE`
- `PERIOD_LOCKED`
- `POSTED_ENTRY_IMMUTABLE`
- `REVERSAL_NOT_ALLOWED`
- `DUPLICATE_REFERENCE`
- `CURRENCY_MISMATCH`

### Schedules and Reporting
- `SCHEDULE_NOT_FOUND`
- `SCHEDULE_VARIANCE_DETECTED`
- `SCHEDULE_NOT_RECONCILED`
- `REPORT_NOT_AVAILABLE`
- `UNSUPPORTED_REPORT_FILTER`

### Approvals
- `APPROVAL_REQUIRED`
- `APPROVAL_NOT_FOUND`
- `APPROVAL_ALREADY_RESOLVED`
- `APPROVAL_POLICY_DENIED`

### Idempotency and Concurrency
- `MISSING_IDEMPOTENCY_KEY`
- `IDEMPOTENCY_CONFLICT`
- `DUPLICATE_REQUEST`
- `CONCURRENT_MODIFICATION`

### Agent Tool Layer
- `UNKNOWN_TOOL`
- `TOOL_INPUT_INVALID`
- `TOOL_EXECUTION_FAILED`
- `TOOL_BATCH_PARTIAL_FAILURE`

### Infrastructure
- `RATE_LIMITED`
- `INTERNAL_ERROR`
- `DEPENDENCY_UNAVAILABLE`

## Approval Rules

All write actions pass through policy evaluation.

Possible outcomes:
- `allowed`
- `approval_required`
- `denied`

Default v1 actions that should require approval:
- manual journal entry above configured threshold
- entries touching equity
- entries touching tax payable/receivable
- prior-period posting
- reversal of posted entries
- schedule reconciliation override with non-zero variance
- period close actions

Default v1 actions that can be auto-allowed:
- draft creation
- validation
- read/report tools
- schedule generation
- low-risk reconciliation actions when explicitly allowed by policy

## Idempotency Rules

All mutating endpoints must require idempotency keys.

Covered operations:
- account creation
- journal draft creation
- draft submission
- draft commit
- reversal
- schedule reconciliation
- approval resolution
- mutating agent tool calls

Required behavior:
- same key + same actor + same action + same normalized payload returns original result
- same key + different payload returns `IDEMPOTENCY_CONFLICT`
- keys should be retained long enough for safe replay, minimum 24 to 72 hours operationally

## Notes
- This document is the stable repo copy of the v1 API direction discussed during planning.
- Detailed DTO-by-DTO implementation and OpenAPI or JSON schema generation is a follow-up task.
