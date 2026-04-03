# nas-linker

[Русская версия](./README.ru.md)

Helper service for turning torrent folders on a Synology NAS into deterministic movie and TV hardlink layouts that Plex can index reliably.

The tool serves a browser UI, validates paths on the server, and executes link operations on the NAS. In the current baseline:

- primary execution path is local Node.js on the NAS
- authentication is app-managed login/session plus a runtime request-binding token
- saved templates are low-sensitivity UX state stored in sqlite

## What It Does

- Link a single movie folder into a normalized movie layout
- Link a season folder into a normalized TV layout
- Browse a restricted subset of NAS folders from the UI
- Save reusable templates for quick repeat linking
- Optionally proxy metadata search through Plex Discover / OMDb without exposing tokens to the browser

## What It Does Not Do

- It is not a torrent client
- It is not a media player or library manager
- It is not a multi-user product
- It is not designed for public internet exposure

## Runtime Model

- Browser UI -> Express helper
- Helper validates requests and enforces auth
- Helper executes linker logic locally on NAS through the built-in Node executor

## Security / Scope Notes

- Intended deployment boundary is LAN or VPN only
- `x-run-token` is a secondary request-binding layer, not the primary auth boundary
- Metadata tokens stay server-side
- Server-side UX state is convenience-only and must remain low-sensitivity and loss-tolerant

## Requirements

- Node.js 22 preferred
- Synology NAS or another host with the same path model
- A writable location for:
  - app checkout
  - sqlite UX-state DB
  - logs / PID / lock files
- Optional for metadata search:
  - Plex Discover token
  - OMDb API key

## Quick Start

### Local UI debug mode

Use this when you only need the page locally for UI/styling work and do not need a production-like DSM setup.

1. Install dependencies:

```sh
npm ci
```

2. Build UI assets:

```sh
npm run build:ui
```

3. Start the server directly:

```sh
node --experimental-sqlite server.mjs
```

4. Open `http://127.0.0.1:8787`.

Notes:

- this is a debug/preview path, not the canonical deployment model
- auth is disabled unless `APP_AUTH_USER` and `APP_AUTH_PASSWORD_HASH` are set together
- metadata search and real NAS operations may still be unavailable or only partially representative without the corresponding env/path setup
- rebuild UI assets with `npm run build:ui` after frontend changes that affect the served bundle

### Local server mode with explicit env

Use this if you want a fuller local server run with your own exported env values.

1. Install dependencies:

```sh
npm ci
```

2. Build UI assets:

```sh
npm run build:ui
```

3. Edit env values or export them in your shell. The tracked [`run.sh`](./run.sh) is a placeholder-based launcher, not a secret store.

4. Start the helper:

```sh
./run.sh
```

### DSM-hosted mode

Operational details live in [ops/dsm/README.md](./ops/dsm/README.md).

High-level flow:

1. Copy the repo to the NAS.
2. Create `ops/dsm/nas-linker.env` from [`ops/dsm/nas-linker.env.example`](./ops/dsm/nas-linker.env.example).
3. Run deploy from the NAS:

```sh
/volume1/scripts/nas-linker/ops/dsm/deploy-helper.sh
```

4. Publish the helper through DSM reverse proxy.
5. Use the boot task for `start-helper.sh` and a manual task for `restart-helper.sh`.

## Minimal Env Surface

Primary env:

- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD_HASH`
- `UX_STATE_DB_PATH` (optional; defaults under `data/ux-state.sqlite`)

Optional metadata search:

- `PLEX_DISCOVER_TOKEN`
- `OMDB_API_KEY`

## Auth Setup

The app login uses:

- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD_HASH`

`APP_AUTH_PASSWORD_HASH` must use this format:

```text
scrypt$N$r$p$salt$hash
```

Generate it with Node:

```sh
node -e 'const crypto=require("node:crypto"); const password=process.argv[1]; const salt=crypto.randomBytes(16).toString("hex"); const N=16384,r=8,p=1; const hash=crypto.scryptSync(password, salt, 32, {N,r,p}).toString("hex"); console.log(`scrypt$${N}$${r}$${p}$${salt}$${hash}`);' 'your_password_here'
```

Then put the result into env with single quotes:

```sh
APP_AUTH_USER="your_user"
APP_AUTH_PASSWORD_HASH='scrypt$16384$8$1$...'
```

## Metadata Setup

Metadata search is optional. Core linking and folder browsing work without it.

### Plex Discover

`PLEX_DISCOVER_TOKEN` is only needed if you want `/api/meta/search` to use Plex Discover.

- A local Plex Media Server install is not required for the core linker
- For metadata search, you do need a Plex account token that the helper can use server-side
- Plex documents how to find an `X-Plex-Token` here:
  - [Finding an authentication token / X-Plex-Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)

### OMDb

`OMDB_API_KEY` is optional. It is used only to enrich search results with poster thumbnails when OMDb can provide them.

- Without `OMDB_API_KEY`, linking still works
- Without it, metadata results may simply have no poster enrichment
- OMDb API home / key info:
  - [OMDb API](https://www.omdbapi.com/)

## Repository Layout

- [`server.mjs`](./server.mjs) - canonical server entrypoint
- [`helper.mjs`](./helper.mjs) - compatibility shim for the legacy entrypoint name
- [`src/server/app.mjs`](./src/server/app.mjs) - Express bootstrap and dependency wiring
- [`src/server/config.mjs`](./src/server/config.mjs) - runtime env parsing and default dependency assembly
- [`src/server/auth/`](./src/server/auth) - auth modules for session and runtime-token request binding
- [`src/server/routes/index.mjs`](./src/server/routes/index.mjs) - top-level route composition
- [`src/server/routes/`](./src/server/routes) - route modules split by session, linking, metadata, saved templates, and shell
- [`src/server/metadata/`](./src/server/metadata) - Plex Discover and OMDb metadata helpers
- [`src/server/ui/`](./src/server/ui) - HTML shell loading and token/template injection
- [`src/core/executor.mjs`](./src/core/executor.mjs) - primary Node executor and path guardrails
- [`src/core/saved-templates-store.mjs`](./src/core/saved-templates-store.mjs) - sqlite-backed saved-template storage
- [`src/templates/app-shell.html`](./src/templates/app-shell.html) - authenticated app shell template
- [`src/templates/login-shell.html`](./src/templates/login-shell.html) - unauthenticated login shell template
- [`src/ui/`](./src/ui) - Vite UI source
- [`dist/app/`](./dist/app) - built UI assets served by helper at `/assets/app/...`
- [`assets/vendor/`](./assets/vendor) - checked-in vendor static assets served at `/assets/vendor/...`
- [`docs/roadmap.md`](./docs/roadmap.md) - planning notes, release steps, and historical roadmap snapshots
- [`ops/dsm/`](./ops/dsm) - DSM lifecycle and deploy scripts
- [`test/`](./test) - automated tests

## Tests

```sh
npm test
```

The test suite covers executor behavior, helper API contracts, auth/session boundaries, token non-leakage, and static-asset bootstrap.

## Publication Notes

- Do not commit filled env files or runtime sqlite state
- If you plan to publish a clean public history, audit old commits for local infra identifiers and any previously committed tokens or API keys
- Current repo docs contain Synology-specific examples; treat them as deployment examples, not required product semantics
