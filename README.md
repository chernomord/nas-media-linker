# nas-linker

Helper service for turning torrent folders on a Synology NAS into deterministic movie and TV hardlink layouts that Plex can index reliably.

The tool serves a browser UI, validates paths on the server, and executes link operations on the NAS. In the current baseline:

- primary execution path is local Node.js on the NAS
- SSH + `linkmedia.sh` remain as a rollback path
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
- Helper executes linker logic locally on NAS in `EXECUTOR_MODE=node`
- Optional rollback mode executes the existing bash script through SSH

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
- with `EXECUTOR_MODE=node` (default), startup does not require rollback-only SSH env
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

Primary path:

- `EXECUTOR_MODE=node`
- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD_HASH`
- `UX_STATE_DB_PATH` (optional; defaults under `data/ux-state.sqlite`)

Rollback-only path:

- `NAS_HOST`
- `NAS_USER`
- `NAS_KEY_PATH`
- `NAS_SCRIPT`

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
- [`src/server/app.mjs`](./src/server/app.mjs) - Express app assembly, auth/session, executors, UI templating
- [`lib/executor.mjs`](./lib/executor.mjs) - primary Node executor and bash rollback integration
- [`lib/saved-templates-store.mjs`](./lib/saved-templates-store.mjs) - sqlite-backed saved-template storage
- [`src/templates/app-shell.html`](./src/templates/app-shell.html) - authenticated app shell template
- [`src/templates/login-shell.html`](./src/templates/login-shell.html) - unauthenticated login shell template
- [`src/ui/`](./src/ui) - Vite UI source
- [`assets/app/`](./assets/app) - built UI assets served by helper
- [`ops/dsm/`](./ops/dsm) - DSM lifecycle and deploy scripts
- [`test/`](./test) - automated tests

## Tests

```sh
npm test
```

The test suite covers executor behavior, helper API contracts, auth/session boundaries, token non-leakage, rollback-path behavior, and static-asset bootstrap.

## Publication Notes

- Do not commit filled env files or runtime sqlite state
- If you plan to publish a clean public history, audit old commits for local infra identifiers and any previously committed tokens or API keys
- Current repo docs contain Synology-specific examples; treat them as deployment examples, not required product semantics
