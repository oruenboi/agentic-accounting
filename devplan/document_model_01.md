---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Document Model 01

## Purpose
Define the v1 file and document model for uploaded evidence, working papers, report exports, and linked attachments across the accounting platform.

## Design Principles
- Binary files live in object storage; relational tables hold identity, linkage, status, and access metadata.
- Documents are evidence objects, not just generic uploads.
- A single file may support multiple business entities through explicit links.
- Sensitive documents must remain tenant-scoped and auditable.
- Evidence used in approvals, schedules, or period close must be preservable and traceable.

## Document Categories

### Source documents
Examples:
- invoices
- bills
- receipts
- contracts
- bank statements

Purpose:
- support accounting judgments and postings

### Working papers
Examples:
- reconciliations
- supporting spreadsheets
- internal review notes
- exported analysis files

Purpose:
- support internal firm workflow and review

### Report exports
Examples:
- balance sheet PDF
- trial balance export
- close pack artifacts

Purpose:
- preserve formal outputs or review snapshots

### Audit artifacts
Examples:
- request payload archives
- generated evidence bundles
- structured JSON support files

Purpose:
- preserve machine-generated evidence when needed

## Core Tables

### `attachments`
Represents the stored file object and its metadata.

Suggested fields:
- `id`
- `firm_id`
- `organization_id`
- `storage_bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `byte_size`
- `checksum`
- `document_category`
- `status`
- `uploaded_by_actor_type`
- `uploaded_by_actor_id`
- `uploaded_at`
- `archived_at`
- `metadata`

Recommended `document_category` values:
- `source_document`
- `bank_statement`
- `working_paper`
- `report_export`
- `audit_artifact`
- `other`

Recommended `status` values:
- `active`
- `archived`
- `superseded`
- `deleted_pending_retention`

### `attachment_links`
Represents explicit attachment-to-entity links.

Suggested fields:
- `id`
- `attachment_id`
- `firm_id`
- `organization_id`
- `linked_entity_type`
- `linked_entity_id`
- `link_purpose`
- `is_primary`
- `created_by_actor_type`
- `created_by_actor_id`
- `created_at`
- `metadata`

Recommended `link_purpose` values:
- `supporting_evidence`
- `approval_attachment`
- `schedule_support`
- `close_evidence`
- `report_export`
- `source_reference`

This link table is required even if the file only links to one entity. It keeps the model consistent and supports reuse.

## Document Lifecycle

### Upload
1. file uploaded to `Supabase Storage`
2. metadata row created in `attachments`
3. link rows created in `attachment_links`
4. audit event written

### Active use
- documents are visible to authorized users
- linked entities expose attachment summaries
- approvals, schedules, and close views can include them as evidence

### Supersession
When a new version replaces an old one:
- new attachment row created
- prior attachment marked `superseded`
- link relationships updated or preserved depending on policy

### Archive
Files no longer active in normal workflows can be marked `archived` while preserving access for evidence and audit review.

### Deletion
True deletion should be rare and policy-driven.
- soft-hide first
- only hard-delete under admin-controlled retention policy
- preserve audit record of deletion decision

## Entity Linking Rules

### Minimum link targets
The document model should support linking to:
- `journal_entry_drafts`
- `journal_entries`
- `approval_requests`
- `schedule_runs`
- `schedule_reconciliations`
- `close_checklist_runs`
- `report_runs`
- `exceptions`
- `agent_proposals`

### One-to-many and many-to-many
- one file can support many entities
- one entity can have many files

This is required for realistic month-end review and evidence reuse.

## Access Control

### Tenant scope
- every attachment row must carry `firm_id` and `organization_id`
- object paths must match tenant context

### Permission model
Suggested permissions:
- `attachment.read`
- `attachment.upload`
- `attachment.link`
- `attachment.archive`

Not all org members should have full upload or archive rights.

### Sensitive evidence
Some attachments may need tighter control than general read access.

Examples:
- payroll support
- tax correspondence
- internal reviewer working papers

V1 can handle this with document category plus role-based gating, without a full document ACL system.

## Storage Conventions
The document model should align with `storage_blueprint_01.md`.

Recommended buckets:
- `client-documents`
- `bank-statements`
- `working-papers`
- `report-exports`
- `audit-artifacts`

Recommended path pattern:

```text
firm/{firm_id}/org/{organization_id}/{category}/{year}/{month}/{file_name}
```

## File Integrity
Metadata should support:
- content checksum
- MIME type
- byte size
- upload timestamp
- uploader identity

Checksum is important for:
- duplicate detection
- evidence integrity
- proving stored artifact identity later

## Evidence Use Cases

### Approval support
Approval requests may require one or more attachments:
- invoice PDF
- working paper
- explanation memo

The approval detail view should expose linked attachments clearly.

### Schedule support
Schedules may link to:
- AR/AP support files
- reconciliation spreadsheets
- statement PDFs

### Close evidence
Close runs may link to:
- report exports
- schedules
- reviewer signoff packets
- unresolved issue memos

### Agent support
Agents may reference attachments as read-only evidence inputs, but attachment access must remain tenant- and permission-scoped.

## Query Expectations

Internal API candidates:
- `POST /api/v1/attachments`
- `GET /api/v1/attachments/:attachmentId`
- `GET /api/v1/attachments?organization_id=...`
- `POST /api/v1/attachments/:attachmentId/link`
- `GET /api/v1/entities/:entityType/:entityId/attachments`
- `POST /api/v1/attachments/:attachmentId/archive`

Agent tool candidates:
- `get_entity_attachments`
- `get_attachment_metadata`

V1 should keep agents read-only with respect to attachments unless there is a clear controlled upload path later.

## UI Expectations

### Entity attachment panel
Every major entity view should support:
- attachment list
- category badge
- uploader
- upload timestamp
- link purpose

### Approval attachment section
Approval detail should show:
- required support present or missing
- linked files
- ability to open/download

### Close evidence panel
Close run view should show:
- linked exports
- working papers
- schedule support files

## Audit Expectations
Attachment operations should write audit events such as:
- `attachment.created`
- `attachment.linked`
- `attachment.archived`
- `attachment.superseded`

Attachment reads do not need full audit logging in v1 unless policy later requires access auditing for sensitive categories.

## Non-Goals For V1
- document OCR pipeline
- full document version-control system
- legal hold engine
- per-document custom ACLs
- external DMS synchronization

## Dependencies
- storage blueprint
- audit model
- audit read model
- workflow/close model

## Implementation Sequence
1. Add `attachments`
2. Add `attachment_links`
3. Add storage upload and metadata write path
4. Add entity attachment queries
5. Add audit events for attachment lifecycle
6. Add approval/schedule/close linkage

## Acceptance Criteria
- Files can be represented as tenant-scoped attachments with stable metadata.
- Attachments can be linked to multiple business entities through explicit link records.
- The document model supports approvals, schedules, reports, and close evidence without duplicating binary files.
- Attachment metadata is sufficient for integrity checks, audit linkage, and UI display.
- The model is detailed enough to guide schema, API, and storage work.
