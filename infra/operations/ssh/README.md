# SSH Hardening

`00-agentic-hardening.conf` is installed in `/etc/ssh/sshd_config.d/` on the
production VPS. The `00-` prefix is intentional: OpenSSH uses the first value
it obtains, while Hostinger and cloud-init provide later snippets that enable
password authentication.

Before installation, verify a fresh key-based login for the `darryl` account
and confirm that the account has the expected sudo policy. Validate every
change with `sshd -t` before reloading SSH, and keep an existing administrative
session available until a second fresh login succeeds.

The policy disables direct root and password login, keeps public-key login,
disables keyboard-interactive and X11 forwarding, and limits authentication
attempts to three.

