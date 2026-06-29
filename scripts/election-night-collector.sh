#!/usr/bin/env bash
# Deprecated — the ENR collector now runs inside Keel.
# Use the Election Monitor → ENR collector panel (header icon), or:
#   curl -X POST http://localhost:3001/api/election/collector/start -b "your-session-cookie"
#
# For Docker, set ELECTION_COLLECTOR_AUTO_START=1 in compose env.

set -euo pipefail
echo "The El Paso ENR collector is bundled in Keel."
echo "Open Election Monitor and use the ENR collector panel in the header."
echo "Or set ELECTION_COLLECTOR_AUTO_START=1 in your environment."
exit 0
