# PostgreSQL Backups

This directory contains the production PostgreSQL logical-backup job for the
Agentic Accounting VPS.

## Schedule and retention

- systemd starts the job daily at 18:30 UTC, with up to 15 minutes of jitter
- `Persistent=true` runs a missed backup after the server returns
- successful dumps are stored in `/srv/backups/agentic-accounting/daily`
- dumps and checksum files are root-only and retained for 14 days
- Hostinger's separate weekly VPS backups remain the infrastructure-level
  recovery path

## Install

```bash
sudo install -o root -g root -m 750 \
  agentic-accounting-backup /usr/local/sbin/agentic-accounting-backup
sudo install -o root -g root -m 644 \
  agentic-accounting-backup.service /etc/systemd/system/
sudo install -o root -g root -m 644 \
  agentic-accounting-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now agentic-accounting-backup.timer
```

Run `sudo systemctl start agentic-accounting-backup.service` after installation
and verify the resulting archive with `gzip -t` and its adjacent SHA-256 file.
The job intentionally does not print database contents or environment values.

## Restore constraint

The dump is a cluster-wide `pg_dumpall --clean` archive. A disposable restore
must start from a compatible Supabase PostgreSQL image and use a bootstrap
superuser that is not present in the dump. Replaying it over an already
initialized Supabase cluster fails on reserved roles and preinstalled extension
objects. Do not restore directly into production; maintain a tested,
Supabase-aware restore runbook before relying on the logical dump as the sole
recovery mechanism.

