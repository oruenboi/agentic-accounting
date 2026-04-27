# Security Policy

## Supported Scope

Agentic Accounting is still pre-1.0 and under active implementation. Security reports are accepted for the current repository state, including:

- backend API code in `apps/api`
- operator console code in `apps/web`
- Supabase migrations, RLS helpers, and database guard logic under `infra/supabase`
- Docker, Caddy, and deployment examples under `infra/docker`
- documented OpenClaw integration paths and agent-tool contracts

The project is not yet a complete hosted service. Reports should be based on the public repository, self-hosted deployments, or deployment guidance published in this repo.

## Reporting A Vulnerability

Do not open a public issue for suspected vulnerabilities.

Report security issues privately to the maintainers at:

```text
security@nexiuslabs.com
```

If that mailbox is not yet active for your deployment or fork, contact the repository maintainers through the private channel listed by the project owner before publishing details.

Please include:

- affected component or file path
- a clear description of the issue
- reproduction steps or proof-of-concept details
- expected impact, including any tenant isolation, authorization, approval, audit, ledger, or data exposure risk
- whether the issue affects a default local setup, documented production deployment, or a custom deployment

## Response Expectations

The maintainers will aim to:

- acknowledge credible reports within 5 business days
- triage severity and affected versions or deployment paths
- coordinate a fix or mitigation before public disclosure where practical
- credit reporters when requested and appropriate

Because the project is pre-1.0, some reports may result in documentation changes, hardening guidance, or explicit unsupported-configuration notes rather than immediate runtime patches.

## High-Risk Areas

Reports in these areas receive priority:

- authentication and session handling
- tenant isolation and organization membership enforcement
- Supabase RLS policies and database helper functions
- agent credential handling and delegated user context
- approval routing, approval resolution, and escalation controls
- ledger posting, reversal, and immutability guarantees
- idempotency replay and conflict behavior
- audit event completeness or tamper resistance
- document storage, retention, and export paths
- deployment examples that expose secrets or weaken transport security

## Responsible Disclosure

Give maintainers a reasonable opportunity to investigate and remediate before publishing vulnerability details. Do not access, modify, delete, or exfiltrate data that does not belong to you. Do not run tests against deployments unless you own the deployment or have explicit permission from its operator.

Good-faith research against your own local or authorized self-hosted deployment is welcome when it is limited to confirming and reporting the issue.

## Non-Security Issues

Use normal GitHub issues or pull requests for:

- bugs without a confidentiality, integrity, availability, tenant isolation, or authorization impact
- feature requests
- documentation corrections
- general accounting behavior questions

When unsure, report privately first.
