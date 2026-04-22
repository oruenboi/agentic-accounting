---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# Operational Setup 01

## Purpose
Define the concrete operational baseline for the accounting platform so development, staging, production, migrations, backups, observability, and incident handling all follow the same control model.

## Operating Principles
- Production safety matters more than environment convenience.
- Every environment should behave like a smaller version of production, not a different system.
- Accounting data, approvals, and audit history must be recoverable and explainable.
- Deployment and migration steps must be boring, scripted, and repeatable.
- Operational state should be visible through logs, metrics, traces, and runbooks, not tribal knowledge.

## Environment Layout

### Local
Purpose:
- feature work
- schema iteration
- service development
- test execution

Characteristics:
- isolated developer database
- local app instances or dev containers
- disposable storage buckets or test buckets
- seeded fixtures for realistic tenant, ledger, and approval scenarios

Rules:
- local data may be reset frequently
- local environment must still respect tenant isolation and core posting invariants
- migrations should run locally before any shared environment

### Development
Purpose:
- collaborative integration
- branch-level or shared integration testing

Characteristics:
- shared Supabase project or equivalent shared backend
- non-production data only
- frequent migration application
- aggressive feature iteration

Rules:
- development should mimic production configuration where practical
- development must not contain real client data

### Staging
Purpose:
- production rehearsal
- release validation
- smoke testing

Characteristics:
- production-like configuration
- representative data volume where possible
- release candidate deployments
- approval and reporting flows exercised end to end

Rules:
- staging should use the same migration order and deployment path as production
- staging should validate the current release candidate before production rollout
- staging should be treated as the final gate for schema, API, and workflow changes

### Production
Purpose:
- live accounting operations

Characteristics:
- strict access control
- durable backups
- controlled deployment windows
- highest observability and audit expectations

Rules:
- no ad hoc schema changes
- no manual direct writes that bypass the application and migration flow
- changes to ledger, approvals, or audit behavior must be planned and reviewed

## Secrets Handling

### Principles
- secrets never live in source control
- secrets are environment-scoped
- secrets should be rotated when personnel or integrations change
- least privilege applies to every secret

### Secret categories
- database connection strings
- Supabase service credentials
- JWT signing or verification material where applicable
- third-party integration credentials
- object storage credentials
- observability and alerting tokens

### Handling expectations
- use environment variables or a secret manager
- do not commit `.env` files with real values
- separate local, dev, staging, and production secrets
- restrict production secrets to deployment and runtime systems only

### Rotation expectations
- rotate service credentials after suspected exposure
- rotate integration secrets on vendor change or staff offboarding
- record secret ownership and rotation responsibility in runbooks

## Migration Workflow

### Source of truth
- SQL migrations are the canonical schema change mechanism
- every schema change should be represented as a migration file

### Workflow
1. develop schema locally
2. validate migration syntax and ordering
3. apply to dev environment
4. test with representative data
5. apply to staging
6. validate release candidate
7. deploy to production during a controlled window

### Rules
- migrations should be additive and reversible where practical
- destructive changes require explicit review
- ledger and audit migrations need extra scrutiny
- new migrations must consider RLS, indexes, and backfill cost

### Backfill expectations
- plan backfills explicitly
- run large backfills as jobs if needed
- confirm that reporting and workflow queries still behave correctly after schema changes

## Backup and Restore

### Database backup
Requirements:
- automated backups for Postgres
- point-in-time recovery if available
- retention aligned to accounting and audit requirements

### Object storage backup
Requirements:
- preserve uploaded documents, working papers, and exported evidence
- keep storage paths and attachment metadata in sync with DB backups

### Restore expectations
- database and storage should be recoverable together
- restore procedures must preserve tenant boundaries
- restored systems must be validated before returning to service

### Drill requirements
- test restore procedures on a schedule
- verify that ledger, approvals, audit logs, and attachments are intact after restore
- confirm reporting and close evidence can be reconstructed

## Observability

### Logs
Log:
- request identifiers
- correlation identifiers
- actor identity
- organization identifier
- action name
- job identifiers
- error codes

Rules:
- logs should not contain secrets or raw sensitive payloads unless explicitly required
- financial mutations should have enough context to explain the action later

### Metrics
Track:
- request latency
- job queue depth
- job failure rate
- migration success rate
- approval backlog
- close blockers
- report generation duration

### Traces
Trace:
- request to service to database flow
- agent tool execution
- long-running job execution
- approval-related operations

### Alerts
Alert on:
- failed deployments
- migration failures
- repeated job failures
- elevated API error rates
- stuck close or approval queues
- backup failure or restore validation failure

## Release And Deploy

### Release model
- deploy application and schema changes in a controlled sequence
- prefer small, frequent releases over large bundles
- separate backend, migration, and UI release validation where possible

### Production release expectations
- release notes or change log for meaningful updates
- migration plan reviewed before production rollout
- post-deploy smoke checks
- rollback or mitigation path identified in advance

### Deployment order
Recommended order:
1. database migration
2. backend deployment
3. worker deployment
4. frontend deployment
5. smoke validation

### Rollback model
- avoid rollback strategies that destroy data
- prefer forward-fix for schema changes where rollback is unsafe
- if rollback is required, define it before deployment

## Incident Handling

### Incident types
- deployment failure
- migration failure
- data integrity issue
- approval workflow failure
- reporting discrepancy
- job backlog or worker outage
- backup failure
- unauthorized access concern

### Response flow
1. detect
2. triage
3. contain
4. preserve evidence
5. fix or mitigate
6. verify recovery
7. document the incident

### Accounting-specific expectations
- if accounting data integrity is affected, freeze risky writes until the issue is understood
- preserve the evidence trail
- track the affected organization and accounting period explicitly
- avoid silent correction without audit record

### Escalation
- high-risk production incidents should escalate to the operational owner and accounting owner
- security or access incidents should escalate immediately

## Runbooks

### Required runbooks
- environment bootstrap
- migration deployment
- backup verification
- restore drill
- release smoke test
- worker restart and queue recovery
- stuck approval queue handling
- stuck close checklist handling
- reporting discrepancy investigation
- unauthorized access response

### Runbook expectations
Each runbook should contain:
- purpose
- prerequisites
- exact steps
- validation checks
- rollback or recovery steps
- owner
- escalation point

### Ownership
- every runbook needs a named operational owner
- runbooks should be versioned with the repo
- runbooks should be kept current with migration and architecture changes

## Environment Parity
The closer non-production environments are to production, the fewer surprises will appear during release.

Minimum parity goals:
- same migration order
- same RLS posture
- same core job execution model
- same audit logging shape
- same release validation steps

## Non-Goals For V1
- full infrastructure-as-code specification
- provider-specific deployment manifests
- exhaustive SRE handbook
- cross-cloud disaster recovery architecture

## Dependencies
- storage blueprint
- background job architecture
- audit read model
- workflow and close model
- reporting and schedule designs

## Acceptance Criteria
- The document defines local, dev, staging, and production expectations clearly enough to support implementation and release work.
- Secrets, migrations, backups, observability, incident handling, and runbooks are described in operational terms rather than abstract principles.
- The setup model aligns with the accounting control requirements and the agent-enabled architecture.
