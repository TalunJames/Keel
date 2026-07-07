# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the Vite frontend ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 needs a toolchain to compile during `npm ci`
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: production node_modules only ----------
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Build-time metadata, surfaced at runtime via KEEL_* env vars and /api/version.
# The Actions workflow passes these as --build-arg; local builds get sensible defaults.
ARG GIT_SHA=dev
ARG GIT_SHA_SHORT=dev
ARG BUILD_TIME=unknown
ARG GIT_REF=local

ENV NODE_ENV=production \
    PORT=3001 \
    SERVE_STATIC=true \
    DATABASE_PATH=/app/data/keel.db \
    VOTER_DATA_DIR=/app/data/voter \
    ELECTION_DATA_DIR=/app/data/election \
    ELECTION_RESULTS_DB_PATH=/app/data/election/results.db \
    EP_DB_PATH=/app/data/election/results.db \
    EP_RAW_DIR=/app/data/election/raw \
    KEEL_GIT_SHA=$GIT_SHA \
    KEEL_GIT_SHA_SHORT=$GIT_SHA_SHORT \
    KEEL_BUILD_TIME=$BUILD_TIME \
    KEEL_GIT_REF=$GIT_REF

# tini gives us PID 1 signal handling so SIGTERM cleanly shuts down node
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates python3 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/dist         ./dist
COPY package.json ./
COPY server ./server
COPY vendor ./vendor
COPY election-collector ./election-collector
COPY docker-entrypoint.sh ./

# Run as a dedicated non-root user. UID/GID 568 matches the TrueNAS Scale
# built-in `apps` user, so the image default lines up with docker-compose.yml
# (`user: "568:568"`) and the chown'd host bind mounts. The writable dirs are
# created and chown'd so SQLite and uploads work whether or not compose
# overrides the user.
RUN groupadd --gid 568 keel \
 && useradd --uid 568 --gid 568 --no-create-home --shell /usr/sbin/nologin keel \
 && chmod +x docker-entrypoint.sh \
 && mkdir -p /app/data /app/data/voter /app/data/election /app/uploads \
 && chown -R 568:568 /app/data /app/uploads

USER 568:568

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "./docker-entrypoint.sh"]
