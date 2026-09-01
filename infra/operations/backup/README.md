# PostgreSQL Backups

This directory contains the production PostgreSQL logical-backup job for the
Agentic Accounting VPS.

## Schedule and retention

- systemd starts the job daily at 18:30 UTC, with up to 15 minutes of jitter
- `Persistent=true` runs a missed backup after the server returns
- successful dumps are stored in `/srv/backups/agentic-accounting/daily`
- custom-format dumps and checksum files are root-only and retained for 14 days
- Hostinger's separate weekly VPS backups remain the infrastructure-level
  recovery path

## Install

```bash
sudo install -o root -g root -m 750 \
  agentic-accounting-backup /usr/local/sbin/agentic-accounting-backup
sudo install -o root -g root -m 750 \
  agentic-accounting-restore-rehearsal /usr/local/sbin/agentic-accounting-restore-rehearsal
sudo install -o root -g root -m 644 \
  agentic-accounting-backup.service /etc/systemd/system/
sudo install -o root -g root -m 644 \
  agentic-accounting-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now agentic-accounting-backup.timer
```

Run `sudo systemctl start agentic-accounting-backup.service` after installation.
The job validates the custom archive table of contents and writes an adjacent
SHA-256 file. It intentionally does not print database contents or environment
values.

## Restore rehearsal

The backup is a database-scoped `pg_dump -Fc` archive. Supabase-managed
extension schemas are excluded because the compatible target image initializes
them before restore. Application schemas, including `public` and `auth`, remain
in the archive.

Run the latest archive through an isolated restore with:

```bash
sudo /usr/local/sbin/agentic-accounting-restore-rehearsal
```

Pass an explicit archive path as the first argument to test an older recovery
point. The rehearsal verifies the checksum, starts the digest-pinned production
Supabase PostgreSQL image, restores as its bootstrap superuser, checks critical
application tables, and removes the disposable container. It never connects to
the production database.

Do not restore directly into production. First rehearse the selected archive,
stop all application writers, preserve the failed environment, and restore into
a newly initialized compatible Supabase stack before redirecting traffic.
