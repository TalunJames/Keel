#!/bin/sh
set -e

# Seed the first admin if the users table is empty.
# seed.js is idempotent — it exits 0 with no changes if any user already exists.
if [ -n "${ADMIN_PASSWORD}" ] && [ "${ADMIN_PASSWORD}" != "change-me-on-first-login" ]; then
  node server/seed.js || {
    echo "Seed failed — continuing to start API anyway." >&2
  }
else
  echo "ADMIN_PASSWORD not set (or still default) — skipping seed." >&2
fi

exec node server/index.js
