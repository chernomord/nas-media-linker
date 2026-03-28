# Guardrail Test Mapping

Current snapshot of `Hard` guardrails versus automated coverage.

Status meanings:
- `covered`: there is at least one automated test directly exercising the guardrail
- `partial`: code exists and behavior looks intentional, but there is no direct automated test for the full boundary
- `missing`: no meaningful automated coverage yet
- `ops-manual`: guardrail lives in deployment/process space and is not currently encoded as an automated repo test

## Stable Hard guardrails

| Guardrail | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Path validation (`src/srcDir` inside `TORRENTS_ROOT`) | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `movie endpoint rejects source outside torrents root`, `movie endpoint rejects traversal payload with nested .. segment`, `movie endpoint returns executor-error shape for non-ASCII path under torrents root`, `season endpoint rejects source directory outside torrents root`, `season endpoint rejects traversal payload with nested .. segment`, `season endpoint returns executor-error shape for non-ASCII path under torrents root`, `list endpoint returns executor-error shape for nested traversal under allowed root`, `list endpoint returns executor-error shape for non-ASCII path under allowed root`; [`test/executor.test.mjs`](./test/executor.test.mjs): `listDir rejects traversal segments`, `listDir rejects non-ASCII path segments`, `linkMovie rejects non-ASCII source paths`, `linkSeason rejects non-ASCII source paths` | Remaining gaps are only deeper encoding/normalization policy choices, not missing current ASCII/segment boundary coverage |
| Allowlist for list (`Torrents/Movies/TV only`) | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `list endpoint rejects disallowed root with frozen error shape`, `list endpoint rejects sibling path that only shares allowed-root prefix`, `list endpoint returns executor-error shape for non-ASCII path under allowed root`; route-level `/api/list` success and error variants are now frozen | Remaining gaps are only deeper encoding/normalization policy choices |
| Auth token (`x-run-token` must match runtime token) | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `api routes require x-run-token even after successful Basic auth`, `api routes reject wrong x-run-token` | Remaining gaps are route breadth, not missing core boundary behavior |
| JSON response shapes | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): exact payload checks for `/api/list`, `/api/link/movie`, `/api/link/season`, `/api/meta/search`, `/api/saved-templates*`, including discover upstream-error shape | Remaining gaps are edge-case variants, not missing core contracts |
| Discover token must stay server-side | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `root html includes runtime token placeholder replacement` asserts delivered HTML does not contain discover-token plumbing markers; [`test/discover-token.test.mjs`](./test/discover-token.test.mjs): `configured Plex discover token is used server-side but not leaked to delivered responses` proves a real configured token stays out of delivered HTML and API payloads | Remaining gap is logging-path coverage, tracked separately under `No token logging` |
| Server-side UX state must be low-sensitivity and loss-tolerant | covered | [`test/saved-templates-store.test.mjs`](./test/saved-templates-store.test.mjs) constrains actual schema to template fields only and `saved template store ignores extra secret-like fields` proves extra fields are not persisted | Remaining gaps are policy breadth, not missing storage-boundary enforcement |
| System remains operable if server-side UX state is empty, unavailable, or reset | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `saved template list fails softly when UX storage is unavailable` | Could still add browser-level UI render assertion for warning state |
| No token logging | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `root html includes runtime token placeholder replacement` asserts delivered HTML does not contain discover-token plumbing markers; [`test/no-token-logging.test.mjs`](./test/no-token-logging.test.mjs): `helper startup logs do not contain runtime token or discover token` | Remaining gaps are broader logging surfaces, not missing core startup/response coverage |

## Transitional Hard guardrails

| Guardrail | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Env requirements (`NAS_HOST`, `NAS_USER`, `NAS_KEY_PATH`) for rollback bash mode | covered | [`test/executor.test.mjs`](./test/executor.test.mjs): `bash executor requires SSH config`; [`test/executor-mode.test.mjs`](./test/executor-mode.test.mjs): `helper fails fast in bash mode without SSH rollback env`, `helper fails fast in bash mode when NAS_KEY_PATH does not exist` | Remaining gaps are deeper rollback runtime cases, not startup validation |
| SSH execution via `/bin/bash` rollback path | covered | [`test/parity.test.mjs`](./test/parity.test.mjs) exercises bash path for all three operations; [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `list endpoint uses bash rollback executor path when configured`, `movie endpoint uses bash rollback executor path when configured`, `season endpoint uses bash rollback executor path when configured` prove helper/API request paths form the expected `/bin/bash ...` commands for all three primary operations | Remaining gaps are only deeper edge fixtures, not missing rollback-path route coverage |
| `listdir` output format (`type\|name\|size\|mtime`) | covered | [`test/executor.test.mjs`](./test/executor.test.mjs): `listDir returns sorted items with stable shape`; [`test/parity.test.mjs`](./test/parity.test.mjs): `bash and node listDir produce the same parsed items`; [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `/api/list` success and executor-error shapes | Remaining gaps are edge payload breadth, not missing helper route coverage |
| Preserve spaces in paths (no `_` substitution) | covered | [`test/parity.test.mjs`](./test/parity.test.mjs): `bash and node linkMovie preserve spaces in source and destination paths`, `bash and node linkSeason preserve spaces in source and destination paths`, `bash and node listDir preserve spaces in entry names` | Remaining gaps are broader edge naming cases, not missing core parity |

## v1.1 deployment hard guardrails

| Guardrail | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Network perimeter (LAN + WireGuard only) | ops-manual | Real DSM rollout was manually validated | No repo automation for DSM/router policy |
| No WAN port-forwarding / no UPnP for helper | ops-manual | Manual router policy | No repo automation |
| Additional app-level auth in NAS-hosted mode | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `root returns login shell when session auth is configured and no session exists`, `session login rejects wrong password`, `session login rejects wrong username`, `session login rejects missing credentials payload`, `successful session login makes root return the app shell`, `session logout clears access to the app shell and APIs` | Covered for the main request and lifecycle classes of the new app-session surface |
| Credentials as hash in env | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `createApp rejects incomplete app auth config`, `createApp rejects invalid app auth hash format` | Could still add full process-level startup tests, but fail-fast behavior is already encoded |

## v1.2 hard migration / release guardrails

| Guardrail | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Operation contracts frozen before migration | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs) asserts frozen helper payloads for link/list/meta/saved-template routes, including discover upstream-error path | Remaining gaps are edge-case variants, not missing core contracts |
| Node executor parity layer | covered | [`test/executor.test.mjs`](./test/executor.test.mjs) covers node executor contracts | Helper API surface not covered completely |
| Dual-run verification phase | covered | [`test/parity.test.mjs`](./test/parity.test.mjs) covers `listDir`, `linkMovie`, `linkSeason` | Could add more edge fixtures with spaces and traversal-attempt names |
| Cutover + rollback switch | covered | [`test/executor-mode.test.mjs`](./test/executor-mode.test.mjs): `helper starts in node mode without SSH rollback env`, `helper fails fast in bash mode without SSH rollback env`; existing executor/parity tests exercise both paths separately | Remaining gaps are rollback request-path depth, not mode-selection behavior |
| Done criteria for v1.2 | partial | Manual DSM validation + current test suite support the claim | Not encoded as a release gate artifact beyond this mapping |

## v1.3 hard guardrails

| Guardrail | Status | Evidence | Gap |
| --- | --- | --- | --- |
| Optional server-side storage for low-sensitivity UX state | covered | [`test/saved-templates-store.test.mjs`](./test/saved-templates-store.test.mjs) covers CRUD semantics, natural-key upsert, and `saved template store ignores extra secret-like fields`; [`test/helper-api.test.mjs`](./test/helper-api.test.mjs) covers list/upsert/delete API shapes, degraded unavailable-storage behavior, and `saved template routes ignore unexpected extra fields` | Remaining gaps are policy breadth, not missing core storage-boundary enforcement |
| Local static assets strategy | covered | [`test/helper-api.test.mjs`](./test/helper-api.test.mjs): `root html boots from local static assets without external CDN URLs` proves delivered HTML references local `/assets`, helper serves built CSS/JS, and bootstrap path contains no external CDN URLs; `built UI bundle avoids runtime autoloader paths that helper does not serve` guards against broken `/components/...` runtime fetches; `helper serves the full local UI bootstrap graph used by the page` proves the bundle defines every `sl-*` component used by the page and that all referenced Bootstrap icon assets are helper-served | Remaining gaps are only true headless-browser E2E concerns, not missing runtime-bootstrap coverage |

## Highest-value missing tests

1. Extra auth/token breadth cases if we want exhaustive route parity rather than boundary coverage.
2. Additional process-level startup cases only if we want exhaustive config validation rather than current risk-based coverage.
3. True headless-browser E2E if we ever want stronger runtime assurance than the current bootstrap-graph smoke.
4. Deeper rollback-path edge fixtures only if we want more than current route/contract coverage.
5. Encoding/Unicode policy expansion only if we want to move beyond the current explicit ASCII-path model.
