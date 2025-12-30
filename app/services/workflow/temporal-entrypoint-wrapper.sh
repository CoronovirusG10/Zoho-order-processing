#!/bin/sh
# Wrapper script to fix DNS resolution before running Temporal entrypoint
# Docker sets /etc/hosts and /etc/resolv.conf to mode 640, but the temporal
# user (uid 1000) needs to read these for hostname resolution.

chmod 644 /etc/hosts /etc/resolv.conf 2>/dev/null || true

exec /etc/temporal/entrypoint.sh "$@"
