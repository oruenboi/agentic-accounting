---
owner: Codex
status: in_progress
last_reviewed: 2026-04-05
---

# OpenClaw Distribution And Hardening 01

## Purpose
Define how the accounting platform should relate to OpenClaw in an open-source release, including repository boundaries, plugin packaging, host modifications, deployment topology, and Ansible hardening scope.

## Design Principles
- The accounting platform and OpenClaw are related systems, but they are not the same codebase.
- The accounting backend remains the source of truth for approvals, audit, tenant enforcement, and accounting mutations.
- OpenClaw should be treated as an agent host and orchestration layer, not as the accounting control plane itself.
- Production deployment of OpenClaw in an accounting environment requires explicit hardening, not just default startup instructions.
- Repo boundaries should be clear so contributors understand what is maintained here versus in OpenClaw itself.

## What Ships In This Repository
This repository should contain:
- the accounting backend and related apps
- shared packages:
  - SDK
  - schemas
  - domain
  - OpenClaw plugin package
- integration docs explaining required OpenClaw capabilities
- deployment and hardening docs for the accounting platform and its OpenClaw integration
- optional Ansible roles/playbooks for deploying the accounting platform and OpenClaw together

Recommended paths:
- `packages/openclaw-plugin`
- `examples/openclaw`
- `infra/ansible/accounting-platform`
- `infra/ansible/openclaw`

## What Should Not Be Hidden Inside This Repository
The full OpenClaw host codebase should not be silently vendored into this repo unless there is a deliberate decision to ship a combined platform distribution.

Preferred options:

### Option 1: Companion OpenClaw fork
Maintain:
- this repo for accounting platform and plugin
- a separate OpenClaw fork/repo for host changes

Best when:
- OpenClaw host changes are substantial
- you want a clean upstream contribution path
- you do not want this repo to absorb an entire unrelated codebase

### Option 2: Upstreamed OpenClaw changes
Contribute the required host changes upstream and document:
- minimum OpenClaw version
- required feature set
- any configuration assumptions

Best when:
- the changes are generally useful
- upstream collaboration is realistic

### Option 3: Monolithic bundled distribution
Vendor or submodule OpenClaw into this repo.

Not recommended initially because:
- it increases maintenance burden
- it blurs architecture boundaries
- it makes OSS release and upgrades harder

## Recommended OpenClaw Relationship
V1 recommendation:
- keep OpenClaw host modifications outside the main accounting repo
- keep the accounting plugin package inside this repo
- document the required OpenClaw host changes here
- either maintain a companion fork or target an upstream version that contains the needed features

This keeps the accounting platform focused while still providing a complete integration story.

## What Must Be Modified In OpenClaw
The earlier integration analysis still applies. A production-grade accounting-agent deployment should assume OpenClaw host changes for:

- richer tool-call context
  - `organization_id`
  - `firm_id`
  - `request_id`
  - `correlation_id`
  - `idempotency_key`
  - approval references
- richer approval payloads
- stronger tool metadata and capability declarations
- better session tenant binding
- improved orchestration audit propagation
- better durability around approval references and accounting-critical tool execution

Those modifications belong in:
- an OpenClaw fork
- or upstream OpenClaw if accepted

## What Stays In This Repo For OpenClaw
This repo should own:

### OpenClaw plugin package
- tool definitions
- backend client integration
- metadata contracts
- plugin-side request mapping

### OpenClaw integration examples
- example plugin configuration
- example tenant-scoped tool usage
- example approval-gated flows

### Integration docs
- required OpenClaw host features
- supported versions
- deployment topology
- hardening expectations

## Deployment Topology

### Recommended production topology
- reverse proxy / TLS terminator
- accounting API
- accounting worker service
- accounting web app
- Postgres / Supabase-managed data layer
- object storage
- OpenClaw host

OpenClaw should call the accounting backend through authenticated APIs, not through direct database access.

### Key trust boundaries
- OpenClaw is not allowed direct ledger writes outside backend APIs
- OpenClaw does not own approval truth
- OpenClaw does not bypass tenant or policy enforcement

## Ansible Hardening Scope
If OpenClaw is part of the deployable solution, Ansible hardening should cover it explicitly.

Recommended Ansible scope:

### Base host hardening
- dedicated service users
- least-privilege filesystem permissions
- package patching baseline
- firewall rules
- SSH hardening
- time sync and log retention basics

### Reverse proxy and TLS
- TLS certificates
- secure cipher/protocol defaults
- internal service exposure rules
- rate limiting where appropriate

### Secret handling
- environment file management
- secret injection
- restricted secret-file permissions
- rotation process documentation

### OpenClaw service hardening
- separate runtime user
- limited writable directories
- constrained environment variables
- systemd or equivalent supervision
- restart policy
- resource limits if needed

### Accounting service hardening
- backend and worker service users
- isolated config
- migration execution controls
- storage credentials handling

### Network segmentation
- OpenClaw exposed only through intended ingress
- backend APIs restricted as appropriate
- worker and DB ports not publicly exposed

### Logging and monitoring
- structured logs
- log shipping targets if used
- service health checks
- alert hooks for failures

### Backup-aware deployment
- document backup requirements for platform state and configuration
- protect configuration and credential artifacts needed for disaster recovery

## Recommended Ansible Structure

Within this repo, a clean structure would be:

```text
infra/
  ansible/
    inventory/
    group_vars/
    roles/
      base-hardening/
      reverse-proxy/
      accounting-api/
      accounting-workers/
      accounting-web/
      openclaw/
      monitoring/
    playbooks/
      site.yml
      openclaw.yml
      accounting-platform.yml
```

This lets you:
- deploy only the accounting platform
- deploy only OpenClaw
- deploy the integrated stack

## OpenClaw-Specific Hardening Requirements

### Runtime isolation
- dedicated OS user
- no unnecessary shell or file permissions
- controlled plugin directory permissions

### Approval and audit safety
- do not store durable accounting approval truth only in OpenClaw local state
- ensure OpenClaw logs and request context can be correlated with backend audit records

### Token handling
- keep agent client credentials scoped and rotatable
- avoid broad static secrets in shared configs

### Config management
- maintain explicit environment settings for:
  - backend base URL
  - client identifiers
  - TLS and proxy settings
  - log configuration

### Upgrade strategy
- treat OpenClaw host upgrades as controlled changes
- validate compatibility with the accounting plugin and required host features before rollout

## Release Dependency Model
The OSS release should state clearly:
- which OpenClaw version or fork is supported
- which host modifications are required
- which plugin version matches which backend/API version

Recommended compatibility statement:
- accounting platform release X
- OpenClaw plugin release X
- OpenClaw host version Y or companion fork commit Z

## Documentation Expectations
The public docs should include:
- "What lives in this repo"
- "What lives in OpenClaw"
- "How to deploy the integrated stack"
- "What hardening is expected for production"
- "Which parts are example-only versus production-recommended"

## Non-Goals For V1
- shipping a silently bundled OpenClaw codebase without clear boundaries
- treating default OpenClaw deployment as production-safe for accounting use
- replacing backend controls with host-side approval prompts

## Dependencies
- OpenClaw integration design
- packaging and distribution model
- API auth and client model
- operational setup

## Acceptance Criteria
- The repo clearly distinguishes accounting-platform ownership from OpenClaw host ownership.
- The OpenClaw plugin is treated as part of this platform, while host modifications are documented as external or companion work.
- The deployment model includes hardened OpenClaw operation, not just application functionality.
- Ansible hardening scope is explicit enough to guide future infra implementation.
