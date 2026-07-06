# Keel — Fog Signal Strategies portal

Production-ready staff and client portal with a React frontend and Node API. No demo data ships by default — you seed an admin account, add clients and users, then connect integrations.

## Quick start

```bash
cp .env.example .env
# Set JWT_SECRET (required) and BOOTSTRAP_ADMIN_EMAIL (required) in .env.
# Generate a secret with: openssl rand -hex 32

npm install
npm run dev
```

- **App:** http://localhost:5173  
- **API:** http://localhost:3001  

**First run:** with no users yet, the app enters one-time setup. The server
prints a `SETUP TOKEN: <random>` line to its console — copy it, open the app,
and complete the setup screen: paste the token and choose the admin password
for `BOOTSTRAP_ADMIN_EMAIL`. There is no `ADMIN_PASSWORD`. After that, sign in
with that email and the password you chose.

## Production deploy

```bash
npm run build
SERVE_STATIC=true NODE_ENV=production npm start
```

Serves the Vite build from `dist/` and the API on `PORT` (default 3001). Put TLS and SSO in front of this service (Cloudflare, nginx, or your identity provider).

## What changed from the prototype

| Before | Now |
|--------|-----|
| Babel-in-browser + `Keel.html` | Vite + React build |
| Fake login / demo accounts | Email + password, JWT cookie |
| Hardcoded clients, voters, polls | SQLite + REST API |
| Synthetic 9.4M voter rows | Registered files + warehouse query endpoint (ingest separately) |
| localStorage-only cuts | `voter_cuts` table |
| Role switcher in sidebar | Removed |

## Admin setup (first day)

1. **Users** — Admin Console → Users (staff, client accounts).
2. **Clients** — Admin Console → Clients (retainer accounts).
3. **Voter file** — Ingest a TargetSmart CSV: `npm run voter:ingest -- --client <id> --file /path/to/voters.csv`, then `npm run voter:geocode -- --client <id>`.
4. **Announcements** — Admin → Announce for firm-wide posts.

## Integrations (wire when ready)

Endpoints exist; data is empty until you ingest:

- **Calendar** — `POST` events or Google Calendar sync → `/api/calendar/events`
- **Design** — Odoo → `/api/design/requests`
- **Media** — Muck Rack → `/api/media/mentions`
- **Polling** — `polls` table + `/api/polling/polls`; ingest from `portal/polling/clients/<id>/` via `npm run poll:ingest -- --client <id>`
- **Election** — Bundled El Paso ENR collector (`election-collector/`) + Race Detail Monitor; manage from the UI or `/api/election/collector/*`; results in `data/election/results.db`
- **Voter warehouse** — Per-client SQLite index in `VOTER_DATA_DIR`; ingest via `npm run voter:ingest`, geocode via `npm run voter:geocode`, query/map/export in the Voter Data module

## Environment

See `.env.example` for all variables.

## Legacy prototype files

`Keel.html`, root `app.jsx`, and `views/*.jsx` (non-`src/`) are the old static prototype. Use `index.html` + `src/` + `npm run dev` going forward.
