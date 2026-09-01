# VPS Operations

Production VPS operations are divided into three controlled areas:

- `backup/` contains the daily PostgreSQL logical-backup job and timer
- `deploy/` records source and Docker image provenance without exposing secrets
- `ssh/` contains the early-precedence SSH hardening policy

The live deployment configuration remains in `/srv/agentic-accounting`, the
Supabase stack remains in `/srv/supabase`, and the clean source checkout remains
in `/home/darryl/agentic-accounting`.

Direct root and password SSH login are disabled. Administrators connect as
`darryl` with a dedicated key and elevate with the account's sudo password when
root access is required. Environment files must remain mode `640` or stricter.

Do not rebuild the current production images merely to add a Git tag. The
Dockerfiles currently run `npm install` without consuming the committed
workspace lockfile, so a rebuild is not deterministic. Fix that build contract
before moving Compose from `latest` to revision-based image tags and OCI
revision labels.

