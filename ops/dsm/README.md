# DSM Ops (`v1.5 deploy baseline`)

This folder is the operational source of truth for DSM-hosted mode.

## Runtime profile

- Release state:
  - `v1.1` closed after successful DSM reboot-smoke-test
  - `v1.2` closed with `node` as default executor, `bash` as documented rollback, and automated parity tests passing
  - `v1.5-phase-2` closed with helper-managed login/session replacing browser-native Basic Auth
- App dir: `/volume1/scripts/nas-linker`
- Runtime user: `movies_linker`
- Node runtime: Synology Node.js package (`v22` preferred, `v20` fallback)
- Helper bind: `127.0.0.1:8787`
- External entry: DSM `Login Portal` reverse proxy
- Canonical entry: `https://nas-linker.home.arpa/`
- Auth: helper-managed login/session via `APP_AUTH_USER` + `APP_AUTH_PASSWORD_HASH`
- Executor mode: `EXECUTOR_MODE=bash|node` (`node` default)
- UX state DB: `UX_STATE_DB_PATH` (sqlite file, default under `data/ux-state.sqlite`)

## Files

- `nas-linker.env.example` - shell-safe env template for DSM
- `helper-common.sh` - shared runtime/env/node/PID helpers
- `run-helper.sh` - direct foreground runner for debugging
- `start-helper.sh` - single-instance detached start with PID file
- `stop-helper.sh` - graceful stop with fallback kill
- `restart-helper.sh` - stop + start
- `deploy-helper.sh` - `npm ci` + `npm run build:ui` + restart
- `status-helper.sh` - running/not-running probe

## Expected DSM tasks

Boot task:

```sh
/volume1/scripts/nas-linker/ops/dsm/start-helper.sh
```

Manual restart task:

```sh
/volume1/scripts/nas-linker/ops/dsm/restart-helper.sh
```

Manual deploy/update task:

```sh
/volume1/scripts/nas-linker/ops/dsm/deploy-helper.sh
```

Both tasks should run as `movies_linker`.

Observed validation state:

- helper auto-start survives DSM reboot
- reverse proxy works on `80` and `443`
- canonical access path is `https://nas-linker.home.arpa/`

## Local env file

Create:

```sh
/volume1/scripts/nas-linker/ops/dsm/nas-linker.env
```

Rules:

- do not commit it
- values with spaces use double quotes
- `APP_AUTH_PASSWORD_HASH` must use single quotes because it contains `$`

Generate `APP_AUTH_PASSWORD_HASH` with Node:

```sh
node -e 'const crypto=require("node:crypto"); const password=process.argv[1]; const salt=crypto.randomBytes(16).toString("hex"); const N=16384,r=8,p=1; const hash=crypto.scryptSync(password, salt, 32, {N,r,p}).toString("hex"); console.log(`scrypt$${N}$${r}$${p}$${salt}$${hash}`);' 'your_password_here'
```

Example:

```sh
EXECUTOR_MODE="node"
UX_STATE_DB_PATH="/volume1/scripts/nas-linker/data/ux-state.sqlite"

APP_AUTH_USER="replace_me"
APP_AUTH_PASSWORD_HASH='scrypt$16384$8$1$<salt>$<hash>'
```

Metadata setup notes:

- `PLEX_DISCOVER_TOKEN` is optional and only needed for `/api/meta/search`
- `OMDB_API_KEY` is optional and only used for poster enrichment in search results
- Core browse/link flow works without both of them
- Plex token docs:
  - [Finding an authentication token / X-Plex-Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)
- OMDb:
  - [OMDb API](https://www.omdbapi.com/)

Current `v1.2` execution note:

- `EXECUTOR_MODE="node"` is the default and primary execution path for `listdir`, `linkmovie` and `linkseason`.
- `EXECUTOR_MODE="bash"` remains available as the rollback path.
- `NAS_HOST`, `NAS_USER`, `NAS_KEY_PATH` and `NAS_SCRIPT` are rollback-only settings and are not required for normal `node` startup.
- `saved_templates` now live in sqlite server-side UX storage; localStorage is only a bootstrap source when the server store is empty.
- launch scripts pass `--experimental-sqlite` by default for compatibility with local Node `v22.12.x`; DSM `v22.19.x` also works with that flag.
- `npm test` now covers node executor contracts plus local bash-vs-node parity for all three operations.
- `GET /` now serves a login shell when no valid helper session exists; app shell is returned only after successful login.

Current `v1.5` deploy note:

- canonical boot path stays runtime-only:
  - `start-helper.sh`
  - `restart-helper.sh`
- canonical update path is build-aware:
  - `deploy-helper.sh`
- do not embed `npm ci` or `npm run build:ui` into boot/start scripts
- NAS checkout must include full Node toolchain and devDependencies because `deploy-helper.sh` performs the UI build locally on NAS
- lifecycle scripts are serialized via an ops lock under `.run/`; concurrent `deploy/start/stop/restart` attempts fail fast instead of racing each other

Rollback-only SSH example:

```sh
NAS_HOST="127.0.0.1"
NAS_USER="movies_linker"
NAS_KEY_PATH="/var/services/homes/movies_linker/.ssh/synology_linker"
NAS_SCRIPT="/volume1/scripts/linkmedia.sh"
EXECUTOR_MODE="bash"
```

## Logs and state

- PID file default: `/volume1/scripts/nas-linker/.run/nas-linker.pid`
- Log file default: `/volume1/scripts/nas-linker/helper.log`
- Lock dir default: `/volume1/scripts/nas-linker/.run/nas-linker.lock`

Override paths only via:

- `NAS_LINKER_ENV_FILE`
- `NAS_LINKER_PID_FILE`
- `NAS_LINKER_LOG_FILE`
- `NAS_LINKER_LOCK_DIR`
- `NAS_LINKER_NPM_CI_ARGS`

## One-time cleanup note

If helper was started before lifecycle scripts existed, first stop may require admin/root cleanup of the old detached process. After cutover to `start-helper.sh`, normal lifecycle should go through `stop/restart/status`.

## Post-rollout lessons

- Treat lifecycle as a separate deploy artifact. `Task Scheduler -> Run` is not equivalent to restart.
- Keep runtime recovery and build/deploy separate:
  - `start/restart` should stay fast and build-free
  - `deploy-helper.sh` is the only script that should run `npm ci` and `npm run build:ui`
- Treat DSM ops scripts as mutually exclusive:
  - if `deploy-helper.sh` is running, manual `restart-helper.sh` should fail fast rather than interleave with build/restart steps
  - `status-helper.sh` can now report an in-progress operation from the ops lock
- Always test DSM lifecycle commands in the same runtime user context that owns the process (`movies_linker` here).
- For same-host SSH executor mode, runtime user must own a readable private key in its own `~/.ssh/`.
- Fail fast on env mistakes. Startup validation is better than discovering path/env errors on the first `/api/*` call.
- Keep env files shell-safe:
  - values with spaces use double quotes
  - values containing literal `$` use single quotes
- For reverse proxy bring-up, separate HTTP port smoke test is the lowest-friction first step before canonical HTTPS hostname.
- If `curl --resolve nas-linker.home.arpa:443:<NAS_IP> https://nas-linker.home.arpa/` reaches helper but the browser does not, first check client-side proxy state before touching DSM config.
- On macOS, `scutil --proxy` is the fastest probe for stale local proxies. A broken state may look like:
  - `HTTPEnable : 1`, `HTTPProxy : 127.0.0.1`, `HTTPPort : 8281`
  - `HTTPSEnable : 1`, `HTTPSProxy : 127.0.0.1`, `HTTPSPort : 8281`
- If a local proxy app leaves stale system proxy settings behind, clear them on the active service:
  - `networksetup -setwebproxystate "<service>" off`
  - `networksetup -setsecurewebproxystate "<service>" off`
  - `networksetup -setsocksfirewallproxystate "<service>" off`
