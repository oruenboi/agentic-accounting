# VPS Operations

Production VPS operations are divided into three controlled areas:

- `backup/` contains the daily PostgreSQL logical-backup job and timer
- `deploy/` records source and Docker image provenance without exposing secrets
- `monitoring/` checks containers, public health, and backup freshness
- `ssh/` contains the early-precedence SSH hardening policy

The live deployment configuration remains in `/srv/agentic-accounting`, the
Supabase stack remains in `/srv/supabase`, and the clean source checkout remains
in `/home/darryl/agentic-accounting`.

Direct root and password SSH login are disabled. Administrators connect as
`darryl` with a dedicated key and elevate with the account's sudo password when
root access is required. Environment files must remain mode `640` or stricter.

Production application images consume the committed workspace lockfile, pin
base images by digest, and carry the Git revision in both their tag and OCI
metadata. Build and validate a candidate before changing the revision values in
the deployment `.env` file.
