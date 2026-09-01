# Deployment Provenance

`record-deployment` writes a non-secret manifest containing the source revision
and immutable Docker image IDs used by the current VPS deployment.

Install it as `/usr/local/sbin/agentic-accounting-record-deployment` and run it
after every successful deployment. The default output is
`/srv/agentic-accounting/DEPLOYMENT.manifest` with mode `640` and group
`docker`.

The current production Dockerfiles install dependencies without the workspace
lockfile. Do not claim that an image corresponds to a Git revision solely
because it was built from a clean checkout. First make Docker builds consume
the committed lockfile, add OCI revision labels, and use revision-based image
tags in Compose.

