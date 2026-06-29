#!/bin/sh
set -e

# Bootstrap admin is created automatically in db.js migrate when the users table is empty.
# First boot shows a setup screen to set the administrator password — no ADMIN_PASSWORD needed.

exec node server/index.js
