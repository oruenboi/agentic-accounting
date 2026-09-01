---
owner: Codex
status: in_progress
last_reviewed: 2026-05-08
---

# ERP Master Data 01

## Purpose
Define shared ERP master data for parties, items, documents, numbering, module permissions, and module configuration.

This layer prevents each ERP module from creating its own incompatible customer, vendor, employee, item, or document model.

## Design Principles
- Master data is tenant-scoped unless explicitly firm-level.
- One party can have many roles.
- Items can support services, products, inventory, and billing use cases.
- Documents are evidence and support records, not accounting truth.
- Numbering should be organization-scoped and reusable across modules.
- Permissions should distinguish firm operator workflows from client user workflows.

## Parties
A party is a person, company, or organization that participates in ERP workflows.

Examples:
- customer
- vendor
- employee
- client
- prospect
- contact

Recommended fields:
- `id`
- `firm_id`
- `organization_id`
- `party_type`
- `display_name`
- `legal_name`
- `tax_identifier`
- `registration_number`
- `email`
- `phone`
- `billing_address`
- `shipping_address`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Suggested `party_type` values:
- `individual`
- `company`
- `government`
- `internal`

## Party Roles
A party role describes how a party is used by a module.

Recommended fields:
- `id`
- `firm_id`
- `organization_id`
- `party_id`
- `role`
- `status`
- `role_metadata`
- `created_at`
- `updated_at`

Suggested roles:
- `customer`
- `vendor`
- `employee`
- `client`
- `prospect`
- `contact`

This allows one company to be both a customer and vendor without duplicate master records.

## Items
An item is a product, service, expense type, inventory item, or billable activity that appears on ERP documents.

Recommended fields:
- `id`
- `firm_id`
- `organization_id`
- `item_type`
- `sku`
- `name`
- `description`
- `unit_of_measure`
- `status`
- `default_revenue_account_id`
- `default_expense_account_id`
- `default_inventory_account_id`
- `default_tax_code_id`
- `is_inventory_tracked`
- `metadata`
- `created_at`
- `updated_at`

Suggested `item_type` values:
- `service`
- `product`
- `inventory`
- `expense`
- `time`

Item account defaults should be optional at creation but required before auto-posting.

## Documents
Documents are source evidence and workflow attachments.

ERP modules should reuse the broader document and attachment model rather than storing binary data in module tables.

Examples:
- invoices
- bills
- receipts
- purchase orders
- bank statements
- payslips or payroll summaries
- contracts
- working papers

Recommended document metadata:
- `id`
- `firm_id`
- `organization_id`
- `document_type`
- `document_number`
- `document_date`
- `party_id`
- `status`
- `storage_bucket`
- `storage_path`
- `file_name`
- `mime_type`
- `checksum`
- `extraction_status`
- `extracted_payload`
- `created_at`
- `updated_at`

Documents should link to module entities through a generic link table.

Recommended link fields:
- `document_id`
- `linked_entity_type`
- `linked_entity_id`
- `link_purpose`
- `created_at`

## Numbering Sequences
ERP modules need deterministic organization-scoped numbering.

Examples:
- sales invoice number
- credit note number
- purchase bill reference
- purchase order number
- goods receipt number
- stock adjustment number
- fixed asset number
- payroll import batch number

Recommended fields:
- `id`
- `firm_id`
- `organization_id`
- `sequence_name`
- `prefix`
- `next_value`
- `padding_width`
- `reset_policy`
- `metadata`
- `created_at`
- `updated_at`

Sequence allocation should happen inside the same transaction as document creation where practical.

## Module Registry
The module registry controls which ERP modules are available for a firm or organization.

Recommended fields:
- `id`
- `firm_id`
- `organization_id`
- `module_name`
- `status`
- `enabled_at`
- `enabled_by_user_id`
- `settings`
- `created_at`
- `updated_at`

Suggested module names:
- `sales`
- `purchasing`
- `documents`
- `crm`
- `projects`
- `time_expenses`
- `inventory`
- `fixed_assets`
- `hr`
- `payroll_summary`
- `banking`
- `tax`

## Module Permissions
Module permissions should extend the existing firm and organization role model.

Recommended permission dimensions:
- module
- action
- role
- organization
- approval requirement

Example actions:
- `read`
- `create`
- `edit`
- `submit`
- `approve`
- `void`
- `post`
- `export`
- `configure`

Client viewers should generally have limited read and approval participation. Firm staff roles can operate across assigned organizations according to membership.

## Data Quality Rules
Recommended baseline validation:
- display names must not be blank
- active party roles require active parties
- active items must have unique SKU per organization when SKU is present
- inventory-tracked items require inventory settings before stock movement
- auto-postable items require required account defaults or posting profile mappings
- document links must reference tenant-compatible entities

## Agent Use
Agents may help:
- deduplicate parties
- classify documents
- suggest party roles
- suggest item account mappings
- summarize missing master data
- prepare import cleanup proposals

Agents should not:
- merge parties automatically without approval
- change posting-sensitive account mappings without review
- delete master data
- create auto-postable mappings from low-confidence extraction alone

## Acceptance Criteria
- Customers, vendors, employees, clients, and prospects share a party model.
- Products, services, inventory items, and billable time use one item model where practical.
- Documents are linked evidence, not accounting truth.
- Numbering is organization-scoped and reusable across modules.
- Module permissions can support both firm users and client users.
