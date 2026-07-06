# Deploying Keel to TrueNAS Scale

This guide takes you from the current repo state to a running Keel instance on TrueNAS Scale, fronted by Cloudflare Tunnel, with the container image built and stored on GitHub Container Registry (GHCR).

Path summary:

```
GitHub repo  ──push──▶  GitHub Actions  ──build/push──▶  ghcr.io/talunjames/keel:latest
                                                                     │
                                                                     ▼
                                       TrueNAS Scale (Custom App, docker compose)
                                                                     │
                                                                     ▼
                                       Cloudflare Tunnel ──▶ https://keel.yourdomain.com
```

---

## 1. One-time: push the repo to GitHub

The local working directory isn't a git repo yet.

```bash
cd /path/to/Keel
git init -b main
git add .
git commit -m "Initial commit"

# Create a private repo on github.com first, then:
git remote add origin git@github.com:TalunJames/Keel.git
git push -u origin main
```

You can keep the repo private — GHCR will inherit private visibility for the image. You can flip the repo public later without rebuilding.

The included `.github/workflows/docker.yml` builds the image on every push to `main` and on `v*` tags. No extra GitHub secrets needed — `GITHUB_TOKEN` is provided automatically and has `packages:write` because the workflow declares it.

After the first successful run, your image will be at:

```
ghcr.io/talunjames/keel:latest        # rolling tag from main
ghcr.io/talunjames/keel:v1.0.0        # if you push a tag
ghcr.io/talunjames/keel:sha-abc1234   # immutable per-commit tag (recommended for prod)
```

---

## 2. One-time: let TrueNAS pull from a private GHCR image

If the package is private, TrueNAS needs credentials.

1. On GitHub, create a **classic personal access token** (Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)) with the single scope `read:packages`. Save the token.
2. SSH into TrueNAS Scale and log in, passing the token on stdin so it never
   lands in your shell history or a `ps` listing:
   ```bash
   echo "$PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```
   (Set `PAT` first, e.g. `read -rs PAT` then paste the token.)
3. Verify with `docker pull ghcr.io/talunjames/keel:latest`.

Alternative: in the TrueNAS UI, **Apps → Discover Apps → Manage Container Images → Add → Registry Credentials**, then add a credential entry with `ghcr.io`, your GitHub username, and the PAT. The Custom App UI will then offer this credential when you reference the image.

---

## 3. One-time: dataset and permissions on TrueNAS

```bash
# As root on TrueNAS:
mkdir -p /mnt/<pool>/apps/keel/data
mkdir -p /mnt/<pool>/apps/keel/uploads
chown -R 568:568 /mnt/<pool>/apps/keel
```

Replace `<pool>` with your pool name (e.g. `tank`). Update the `volumes:` paths in `docker-compose.yml` to match.

UID 568 is the built-in `apps` user on TrueNAS Scale — the compose file runs Keel as that user so it can write to the bind mounts.

Snapshot the `keel` dataset on whatever cadence you want — SQLite is in WAL mode and is snapshot-safe while the app is running.

---

## 4. One-time: Cloudflare Tunnel

1. In the Cloudflare Zero Trust dashboard: **Networks → Tunnels → Create a tunnel** → Cloudflared.
2. Name it (e.g. `keel-truenas`). Copy the **tunnel token** — that's the long string after `--token` in the install command.
3. Under **Public Hostnames**, add **one row per public hostname** that should reach Keel. All rows point at the same upstream:
   - **Subdomain:** `keel`  → **Domain:** your domain  → **Service:** `http://keel:3001`
   - **Subdomain:** `portal` → **Domain:** your domain → **Service:** `http://keel:3001`

   Both hostnames terminate at the same Express app inside the container. There's no need for a second service or container.
4. Cloudflare issues TLS certs automatically. URLs will be e.g. `https://keel.fogsignalstrategies.com` and `https://portal.fogsignalstrategies.com`.
5. **Allow both origins in CORS.** In the compose file (or TrueNAS env vars) set `CORS_ORIGIN` to a comma-separated list with no spaces:
   ```
   CORS_ORIGIN=https://keel.fogsignalstrategies.com,https://portal.fogsignalstrategies.com
   ```
   If you skip this, the second hostname will load HTML/CSS but every `/api/*` call from the browser will fail with a CORS error.

Hold onto the tunnel token for step 5.

---

## 5. Deploy on TrueNAS

**Apps → Discover Apps → Custom App** (some TrueNAS versions call this "Install Custom App" or "Launch Docker Image").

In recent TrueNAS Scale (Electric Eel / Fangtooth), the Custom App form takes a `docker-compose.yml` directly. Paste the contents of `docker-compose.yml` from this repo, with these substitutions:

- Replace `ghcr.io/talunjames/keel:latest` with your actual image (e.g. `ghcr.io/cartergh/keel:sha-abc1234` — pinning a SHA is safer than `latest`).
- Replace `/mnt/tank/apps/keel/` with your actual dataset path.
- Set `CORS_ORIGIN` to your public URL (`https://keel.yourdomain.com`).

Then in the **Environment Variables** section, set the required values:

| Variable               | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| `JWT_SECRET`           | **Required.** Output of `openssl rand -hex 32`. In production the app refuses to start without it. |
| `BOOTSTRAP_ADMIN_EMAIL`| **Required.** Email of the initial administrator (no default).     |
| `BOOTSTRAP_ADMIN_NAME` | (optional) Display name for the bootstrap admin.                   |
| `TUNNEL_TOKEN`         | The Cloudflare tunnel token from step 4.                           |

There is **no** `ADMIN_PASSWORD` env var — the admin password is chosen on the
first-boot setup screen (see step 6).

Save and start the app.

---

## 6. First-boot: complete the setup screen

On the very first boot (empty users table) Keel enters a one-time setup mode
and prints a **setup token** to its logs. You use that token, plus a password
you choose, to create the administrator account for `BOOTSTRAP_ADMIN_EMAIL`.

```bash
# On TrueNAS, watch logs:
docker logs -f keel
docker logs -f keel-cloudflared
```

What to look for in the `keel` log:

- `Keel API listening on http://localhost:3001`.
- On the very first boot only, a line like:
  ```
  SETUP TOKEN: 9f3a1c...   (copy this)
  ```
- `Registered tunnel connection` in `keel-cloudflared`.

Then:

1. Open `https://keel.yourdomain.com`. Because setup is still pending, you land
   on the **first-boot setup screen**.
2. Paste the **setup token** from the logs and **choose the admin password**
   for `BOOTSTRAP_ADMIN_EMAIL`.
3. Submit. The admin account is created and you're signed in.

The setup token is single-use and only valid while setup is pending — once the
admin exists, subsequent boots skip setup and go straight to the login screen.
If you didn't catch the token, `docker logs keel` still shows it as long as
setup hasn't completed; restart the container to have it re-printed.

---

## 7. App icon on the TrueNAS Apps page

The repo ships `public/truenaslogo.png`. Vite copies anything in `public/` verbatim into the build, so after the next image push it'll be served at:

```
https://keel.yourdomain.com/truenaslogo.png
```

In the TrueNAS Custom App form (Apps → your Keel app → Edit), paste that URL into the **Application Icon URL** field. Save — the Apps page tile will pick it up.

Notes:
- TrueNAS renders the icon by URL in your browser, so the tunnel needs to be reachable when you load the Apps page (it is, once Keel is running).
- The current PNG is 1040×1024 / ~1.2 MB. Works fine but it's a heavy fetch for a tile-sized icon — consider downsizing to ~256×256 (e.g. `sips -Z 256 public/truenaslogo.png` on macOS) before the next push if you want a snappier Apps page.
- To swap the icon later: drop a replacement into `public/`, push to `main`, and once the new image is deployed the tile updates on next refresh (you may need to bust the browser cache).

## 8. Updates

```bash
# Push a code change:
git commit -am "..."
git push origin main
# GitHub Actions builds + pushes ghcr.io/talunjames/keel:latest
```

The compose file sets `pull_policy: always` on both services, so on TrueNAS
just restart the Custom App (or the whole NAS) — Docker re-checks GHCR before
starting the container and pulls a fresh `:latest` if it changed.

A few notes:

- **Only `main` builds.** The workflow at `.github/workflows/docker.yml` runs
  on `push` to `main` and on `v*` tags. Feature branches don't publish images —
  merge to main (or open a PR and merge it) before expecting a fresh `:latest`.
- **Confirm a build happened.** Check the **Actions** tab on GitHub — the
  newest run should be green and have published a `sha-<short>` tag alongside
  `latest`. If it didn't run, the branch wasn't `main`.
- **If `pull_policy: always` is ignored** by your TrueNAS version (older
  Cobia/Dragonfish), force it manually: SSH in and run
  `docker compose -f /path/to/compose.yml pull && docker compose -f ... up -d`,
  or in the UI, click **Update** on the app to force a re-pull.
- **Pin a SHA for prod.** `:latest` is convenient but can roll back unexpected
  changes if a bad build slips through. For production stability, switch the
  image tag to a specific `sha-abc1234` from the Actions run, and bump it
  deliberately when you want to update.

For rollback: redeploy with the previous `sha-` tag. GHCR keeps all historical tags.

---

## 9. Backups

The only stateful paths are:

- `/mnt/<pool>/apps/keel/data` — SQLite database + WAL files
- `/mnt/<pool>/apps/keel/uploads` — user-uploaded files

Snapshot the `apps/keel` dataset on a Periodic Snapshot Task. Replicate offsite if you care. SQLite WAL is safe to snapshot live.

If you ever need to restore: stop the app, restore the dataset from snapshot, start the app.

---

## Known gotchas

- **Don't change `JWT_SECRET` after going live without warning users** — it invalidates every active session (everyone gets logged out).
- **No `ADMIN_PASSWORD` env var.** The admin password is set once on the first-boot setup screen using the one-time setup token from the logs. To change it later, use the Admin Console in-app.
- **Cookies are `secure: true` in production** ([server/auth.js:27](server/auth.js)). That means logins only persist over HTTPS. Cloudflare Tunnel terminates TLS for you, so this works — but if you ever bypass the tunnel and hit the container over plain HTTP on the LAN, login won't stick.
- **`better-sqlite3` is a native module.** The Dockerfile compiles it during the build stage (Debian slim base + `python3 make g++`). If you change Node major versions, rebuild the image.
- **First boot is slow (~30s)** while the SQLite migrations run and the admin gets seeded. Healthcheck has a 15s `start-period` to account for this.
