# Keel — Fog Signal Strategies portal

Production-ready staff and client portal with a React frontend and Node API. No demo data ships by default — you seed an admin account, add clients and users, then connect integrations.

## Quick start

```bash
cp .env.example .env
# Set ADMIN_PASSWORD and JWT_SECRET in .env

npm install
npm run db:seed
npm run dev
```

- **App:** http://localhost:5173  
- **API:** http://localhost:3001  

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

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
3. **Voter file** — After TargetSmart (or vendor) ingest on the server, register metadata under Admin → Voter (record count, source, client id).
4. **Announcements** — Admin → Announce for firm-wide posts.

## Integrations (wire when ready)

Endpoints exist; data is empty until you ingest:

- **Calendar** — `POST` events or Google Calendar sync → `/api/calendar/events`
- **Design** — Odoo → `/api/design/requests`
- **Media** — Muck Rack → `/api/media/mentions`
- **Polling** — `polls` table + `/api/polling/polls`
- **Election** — Bundled El Paso ENR collector (`election-collector/`) + Race Detail Monitor; manage from the UI or `/api/election/collector/*`; results in `data/election/results.db`
- **Voter warehouse** — Implement row fetch in `server/routes.js` `POST /api/voter/query` against Parquet/DuckDB in `VOTER_DATA_DIR`

## Environment

See `.env.example` for all variables.

## Legacy prototype files

`Keel.html`, root `app.jsx`, and `views/*.jsx` (non-`src/`) are the old static prototype. Use `index.html` + `src/` + `npm run dev` going forward.
