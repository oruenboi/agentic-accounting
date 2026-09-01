# Production Monitoring

The health-check timer validates every five minutes that:

- API, web, proxy, database, auth, and gateway containers are running
- containers with Docker health checks report `healthy`
- the public API reports both application and database status `ok`
- the latest custom PostgreSQL archive is less than 30 hours old
- the latest archive passes its recorded SHA-256 checksum

## Install

```bash
sudo install -o root -g root -m 750 \
  agentic-accounting-healthcheck /usr/local/sbin/agentic-accounting-healthcheck
sudo install -o root -g root -m 644 \
  agentic-accounting-healthcheck.service /etc/systemd/system/
sudo install -o root -g root -m 644 \
  agentic-accounting-healthcheck.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now agentic-accounting-healthcheck.timer
sudo systemctl start agentic-accounting-healthcheck.service
```

Inspect failures with:

```bash
sudo systemctl status agentic-accounting-healthcheck.service
sudo journalctl -u agentic-accounting-healthcheck.service
```

The service intentionally records failures in systemd only. Connect its failed
unit state to an external uptime or incident destination before treating this as
complete alerting; the repository does not assume an email, chat, or pager
provider.
