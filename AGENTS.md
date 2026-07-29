# Keel

Internal dashboard for Fog Signal Strategies. Single Node.js app: a Vite + React
SPA (`src/`) served by an Express API (`server/`) backed by SQLite
(`better-sqlite3`). Two vendored sub-apps (`vendor/periscope`, `vendor/proposals`)
are served as static assets by the main Express server at runtime; they do not
need a separate install for the main dev flow.

## Cursor Cloud specific instructions

### Services

There is one app to run for development. `npm run dev` (see `package.json`)
starts both processes together via `concurrently`:

- `web` — Vite dev server on `http://localhost:5173` (this is the URL you open).
- `api` — Express API on `http://localhost:3001`. Vite proxies `/api`,
  `/periscope`, and `/proposals/app` to it (see `vite.config.js`).

Always open the Vite URL (5173), not the API port. Hitting 3001 directly serves
JSON/health only unless `SERVE_STATIC=true` (production mode).

### First-boot setup (required before you can log in)

On an empty database the API enters one-time setup mode and prints a
`FIRST-BOOT SETUP TOKEN` to the `api` console/logs on every boot while setup is
pending. To sign in the first time, open the SPA, and on the "Set up Keel"
screen paste that token, set your name, and choose a password (min 8 chars).
After setup completes, the token is cleared and subsequent boots go straight to
the login screen.

- The token is regenerated every boot while setup is pending, so if you restart
  the server, re-read the newest token from the `api` output before completing
  setup.
- The bootstrap admin email defaults to `admin@example.com` in dev (override via
  `BOOTSTRAP_ADMIN_EMAIL`). Sign in afterward with that email + the password you
  chose.
- To force a fresh first-boot (e.g. lost the password), set
  `BOOTSTRAP_FORCE_RESET=1` for one boot, or delete the SQLite DB under `data/`.

### Environment / secrets

- `.env` is gitignored and loaded by dotenv via `npm run dev`. In dev, all env
  vars are optional: `JWT_SECRET` is auto-generated if unset (setting a fixed one
  keeps sessions valid across restarts). The SQLite DB is auto-created at
  `data/keel.db`.
- Optional integrations are off unless configured and do not block core use:
  `ANTHROPIC_API_KEY` (proposal-editor AI), `CLEATUS_API_KEY` (pursuit sync),
  SMTP vars (email/invites). Most can also be set in-app under Admin →
  Integrations, which overrides the env var.

### Lint / test / build

- No lint script and no automated test suite exist in this repo (no `lint`/`test`
  script in `package.json`, no test files). CI only builds the Docker image
  (`.github/workflows/docker.yml`).
- Build (production bundle): `npm run build` (Vite → `dist/`). Verifies the SPA
  compiles.
- `better-sqlite3` is a native module. It installs a prebuilt binary via npm; if
  you switch Node major versions and it fails to load, run `npm rebuild
  better-sqlite3`.
