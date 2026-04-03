# AGENTS.md

## Краткое описание
Helper‑сервис для линковки медиа на Synology NAS. UI в браузере отправляет запросы в Express‑сервер. В текущем baseline основной execution path локальный Node executor на NAS. Есть helper-managed login/session, server-side UX state store для saved templates и NAS-side deploy path с on-box UI build.

## Project goals (global)
- Primary goal:
  Создать удобный инструмент нормализации торрентов (кино/сериалы) для безошибочной индексации plex/smb стримингом на nas или любой похожей dedicated машине.
- Secondary goal:
  R&D технологии безопасного процесса разработки solo-оператора с llm и guardrails.
  Критерии успеха:
  - стабильная эволюция продукта;
  - чистые артефакты формализации системы продукта;
  - успешная конвертируемость ограничений в конкретные автоматические тесты.
- Interpretation rule:
  If a change does not clearly serve at least one goal, it must be explicitly deferred.

## Стек
- Node.js (ESM)
- Express
- встроенный sqlite (`node --experimental-sqlite`)
- Shoelace
- Tailwind + Vite build

## Список файлов
- `server.mjs` — canonical server entrypoint.
- `helper.mjs` — compatibility shim для legacy entrypoint name.
- `src/server/app.mjs` — bootstrap Express app и wiring зависимостей.
- `src/server/config.mjs` — runtime config/env parsing и сборка default dependency graph.
- `src/server/auth/` — helper-managed session auth и runtime token binding.
- `src/server/routes/index.mjs` — верхнеуровневая композиция routes.
- `src/server/routes/` — route modules по session/linking/metadata/saved templates/shell.
- `src/server/metadata/` — Plex Discover / OMDb metadata helpers.
- `src/server/ui/` — загрузка и рендеринг HTML shell templates.
- `src/templates/app-shell.html` — основной app shell.
- `src/templates/login-shell.html` — login shell для unauthenticated entry.
- `src/ui/app.js`, `src/ui/app.css` — Vite source для UI assets.
- `dist/app/` — helper-served built UI assets.
- `assets/vendor/` — checked-in vendor static assets.
- `src/core/executor.mjs` — primary Node executor + path guardrails.
- `src/core/saved-templates-store.mjs` — sqlite-backed UX state store.
- `archive/historical-notes/linkmedia.sh` — retired historical artifact бывшего bash executor path.
- `run.sh` — запуск helper‑сервиса (локально).
- `ops/dsm/` — DSM lifecycle scripts (`start/stop/restart/status/deploy`), env template и ops notes.
- `docs/roadmap.md` — planning notes, release steps, and historical roadmap snapshots.
- `package.json` — зависимости и мета.
- `archive/historical-notes/discussion.md` — исторический артефакт; не source of truth и не файл для текущего редактирования.

## Настройка сервиса
### Local mode
1. Укажите `APP_AUTH_USER` + `APP_AUTH_PASSWORD_HASH`, если нужен login gate.
2. При необходимости укажите `PLEX_DISCOVER_TOKEN` и `OMDB_API_KEY` для metadata search.
3. `RUN_TOKEN` вручную не задаётся: токен генерируется на старте локального сервиса и вшивается в UI.

### DSM-hosted mode (`v1.1` baseline)
1. Helper размещается на NAS, например в `/volume1/scripts/nas-linker`.
2. Runtime user: `movies_linker` или другой dedicated DSM user с минимальными правами.
3. Lifecycle в DSM управляется через `ops/dsm/start-helper.sh`, `ops/dsm/stop-helper.sh`, `ops/dsm/restart-helper.sh`, `ops/dsm/status-helper.sh`, `ops/dsm/deploy-helper.sh`.
4. Runtime env хранится вне git в `ops/dsm/nas-linker.env`.
5. DSM boot task должен запускать `start-helper.sh` от runtime user.
6. DSM manual task для ops должен запускать `restart-helper.sh` от runtime user.
7. Helper слушает `127.0.0.1:8787`; внешний вход идёт через DSM `Login Portal` reverse proxy.
8. Для NAS-hosted mode primary auth включается через helper-managed login/session на базе `APP_AUTH_USER` + `APP_AUTH_PASSWORD_HASH`; `x-run-token` остаётся вторичным request-binding слоем.
9. Helper использует только локальный Node executor и не требует SSH env.

## Historical note
Historical migration details and retired runtime paths are preserved in [`docs/roadmap.md`](./docs/roadmap.md) and [`archive/historical-notes/`](./archive/historical-notes). They are no longer part of the current runtime model.

## Guardrails
### Guardrails model
- Each entry defines a non-negotiable or soft constraint.
- Any change must address the same risk_addressed.
- Hard guardrails define security or integrity boundaries.
- Soft guardrails define UX and operability expectations.
- Lifecycle marker is required for roadmap alignment:
  - stable: baseline invariant with no planned removal
  - transitional: temporary invariant/implementation constraint with planned replacement
  - deprecated: kept for compatibility, scheduled for removal

```yaml
- name: Path validation (src/srcDir inside TORRENTS_ROOT)
  scope: Helper
  type: Hard
  lifecycle: stable
  enforced: helper
  failure_mode: arbitrary file access on NAS
  rationale:
    risk_addressed: directory traversal / data exfiltration
    why_this_constraint: helper is the only trusted boundary
    tradeoff: cannot link/list outside torrents root

- name: Allowlist for list (Torrents/Movies/TV only)
  scope: Helper
  type: Hard
  lifecycle: stable
  enforced: helper
  failure_mode: directory traversal / unintended data exposure
  rationale:
    risk_addressed: browsing arbitrary NAS paths
    why_this_constraint: UI is not a trust boundary
    tradeoff: no arbitrary browsing of NAS filesystem

- name: Auth token (x-run-token must match runtime token)
  scope: Helper + UI
  type: Hard
  lifecycle: stable
  enforced: helper + UI
  notes:
    mode_local: primary auth boundary for local helper usage
    mode_nas_hosted: secondary request-binding control; explicit app/proxy auth is primary
  failure_mode: unauthorized API access
  rationale:
    risk_addressed: local cross-site or unintended access
    why_this_constraint: local UI must be the only caller
    tradeoff: token rotates every restart

- name: listdir output format (type|name|size|mtime)
  scope: NAS
  type: Hard
  lifecycle: stable
  enforced: helper/node executor
  failure_mode: UI parsing breaks / wrong listing
  rationale:
    risk_addressed: parsing ambiguity
    why_this_constraint: UI relies on stable delimiter format
    tradeoff: format changes require UI updates

- name: Preserve spaces in paths (no "_" substitution)
  scope: NAS
  type: Hard
  lifecycle: stable
  enforced: helper/node executor
  failure_mode: wrong paths, broken links
  rationale:
    risk_addressed: path corruption
    why_this_constraint: NAS paths can include spaces
    tradeoff: no normalization of paths

- name: JSON response shapes
  scope: Helper
  type: Hard
  lifecycle: stable
  enforced: helper (partial)
  failure_mode: UI parsing errors
  notes:
    link_endpoints: { ok, code, stdout, stderr }
    list_endpoint_ok: { ok, dir, items }
    list_endpoint_error: { ok: false, error|stderr }
    search_endpoint_ok: { ok: true, items: [{ title, year, type, summary?, thumbUrl? }] }
    search_endpoint_error: { ok: false, error|details? }
  rationale:
    risk_addressed: silent UI failures
    why_this_constraint: UI expects predictable payloads
    tradeoff: API changes require UI adjustments

- name: Discover token must stay server-side
  scope: Helper + UI
  type: Hard
  lifecycle: stable
  enforced: helper + UI
  failure_mode: token leakage to browser or storage
  rationale:
    risk_addressed: exposure of Plex Discover token
    why_this_constraint: tokens should never be accessible from UI code
    tradeoff: server must proxy all discover requests

- name: Discover search throttling
  scope: Helper + UI
  type: Soft
  lifecycle: stable
  enforced: UI + helper (partial)
  notes:
    ui_debounce_min_ms: 300
    helper_rate_limit: enable for NAS-hosted mode or after first incident
  failure_mode: excessive calls to Plex Discover / rate limiting
  rationale:
    risk_addressed: API throttling or unstable UI
    why_this_constraint: lightweight throttling should exist even without incident history
    tradeoff: search results slightly delayed

- name: Inline feedback after link actions (status + log)
  scope: UI
  type: Soft
  lifecycle: stable
  enforced: UI
  failure_mode: unclear operation result
  rationale:
    risk_addressed: user uncertainty on long operations
    why_this_constraint: SSH commands are opaque
    tradeoff: slightly more UI elements

- name: Long list handling (truncate + tooltips)
  scope: UI
  type: Soft
  lifecycle: stable
  enforced: UI
  failure_mode: layout break, unreadable list
  rationale:
    risk_addressed: layout overflow with long names
    why_this_constraint: NAS folders can be long
    tradeoff: full name only visible on hover

- name: UX state storage may be client-side or server-side, but must stay non-authoritative
  scope: UI + Helper
  type: Soft
  lifecycle: stable
  enforced: UI + helper
  notes:
    allowed_examples:
      - saved templates
      - recent selections
      - UI preferences
    current_store:
      - localStorage is allowed
      - authenticated server-side storage is allowed in NAS-hosted single-user mode
  failure_mode: broken quick-fill workflow or accidental promotion of convenience state into system authority
  rationale:
    risk_addressed: UX friction across browsers/devices without silently broadening system authority
    why_this_constraint: convenience state may sync, but it must not become integrity-critical
    tradeoff: one more storage path to reason about

- name: Server-side UX state must be low-sensitivity and loss-tolerant
  scope: Helper storage
  type: Hard
  lifecycle: stable
  enforced: helper
  notes:
    allowed:
      - state whose loss does not break linking, browsing, auth, or metadata operations
      - state whose disclosure is low-sensitivity
    forbidden:
      - secrets
      - tokens
      - credentials
      - authority state required for system integrity
      - data required to reconstruct actual NAS media state
  failure_mode: secret exposure or hidden dependency on server-side convenience state
  rationale:
    risk_addressed: scope creep from UX storage into sensitive or integrity-critical storage
    why_this_constraint: NAS-hosted single-user mode can justify convenience sync, but only inside strict boundaries
    tradeoff: some potentially useful state remains intentionally out of scope

- name: System remains operable if server-side UX state is empty, unavailable, or reset
  scope: Helper + UI
  type: Hard
  lifecycle: stable
  enforced: helper + UI
  failure_mode: UX-state outage blocks core linking workflow
  rationale:
    risk_addressed: convenience storage becoming an implicit runtime dependency
    why_this_constraint: saved templates/preferences must accelerate use, not gate use
    tradeoff: UI must degrade explicitly instead of assuming storage is always present

- name: Preview shown only after explicit selection
  scope: UI
  type: Soft
  lifecycle: stable
  enforced: UI
  failure_mode: noisy UI / misleading preview
  rationale:
    risk_addressed: accidental previews from partial input
    why_this_constraint: preview should reflect explicit user intent
    tradeoff: one extra click to see preview

- name: Discover results filter to movie/show
  scope: Helper + UI
  type: Soft
  lifecycle: stable
  enforced: helper + UI (partial)
  failure_mode: irrelevant people/collections in results
  rationale:
    risk_addressed: confusing matches
    why_this_constraint: matching is about media items only
    tradeoff: some edge-case content omitted

- name: No token logging
  scope: Helper + UI
  type: Hard
  lifecycle: stable
  enforced: helper + UI
  failure_mode: token exposure in logs
  rationale:
    risk_addressed: accidental token leakage
    why_this_constraint: logs are not a secure store
    tradeoff: less debug info

- name: Shoelace as primary controls; Tailwind only for layout/typography
  scope: UI
  type: Soft
  lifecycle: stable
  enforced: not enforced
  failure_mode: inconsistent UI, higher maintenance cost
  rationale:
    risk_addressed: fragmented UI styles
    why_this_constraint: simplifies visual consistency
    tradeoff: less flexibility for custom controls
```

### Design Decisions (non-guardrails)
```yaml
- name: Dark cinematic background + light cards; GLSL canvas with CSS fallback
  category: design_decision
  scope: UI
  status: active
  rationale:
    why_this_decision: tool has intentional cinematic visual direction
    tradeoff: extra rendering cost
```

## Testing Boundaries
- `node:test` remains the default automated test layer for contracts, invariants, auth/session rules, executor behavior, and static asset bootstrap.
- Browser-level UI regression testing is justified only for risks that server/unit tests cannot see:
  - layout overflow and truncation failures
  - tooltip/hover affordance regressions
  - locale-switch rendering issues
  - other DOM/CSS interaction bugs that require a real browser engine
- If browser-level testing is introduced later, it must stay intentionally narrow:
  - prefer 1-3 targeted guardrail tests over a broad end-to-end suite
  - use layout assertions first; screenshot comparisons are secondary and should cover only a few high-value states
  - do not make Playwright the primary test harness for the whole project
- Current status:
  - `node:test` remains primary; Playwright is now a thin secondary layer via `npm run test:ui`
  - current Playwright scope is intentionally narrow: browse-list truncation/overflow and live locale-switch behavior
  - browser-level coverage should stay small unless repeated real regressions justify expansion

## Planning Docs
- Active and historical roadmap material lives in [`docs/roadmap.md`](./docs/roadmap.md).
- `AGENTS.md` is the current-model file: goals, active guardrails, design decisions, and non-goals belong here.
- Historical implementation artifacts remain under [`archive/historical-notes/`](./archive/historical-notes).

## Explicit Non-Goals (derived from Goals)
### From Primary (product scope)
- Not a full media library manager/player and not a Plex replacement:
  no playback, no library ownership workflows, no metadata curation beyond normalization needs.
- Not a torrent client:
  no downloading, trackers, seeding, or P2P lifecycle logic.
- Not heuristic/ML-first matching for ambiguous cases:
  deterministic behavior is preferred over "smart guessing".
- Not a multi-user product:
  no roles, ACL matrix, or collaboration workflows.

### From Secondary (process/R&D scope)
- Not a universal framework/methodology for teams:
  scope is solo-operator workflow with LLM assistance.
- No refactors/abstractions "for elegance only":
  changes must be justified by an invariant, explicit risk, or contract.
- Not a DevOps/platform-engineering exercise:
  additional ops sophistication is deferred unless concrete operational pain appears in real use.
- Do not delegate final prioritization/guardrail decisions to LLM:
  LLM proposes candidates; operator is the decision authority.
- No silent exceptions to constraints:
  if reality conflicts with a guardrail, re-frame the guardrail first, then implement.

### Operational constraints (carry-over)
- Remote/public exposure is a non-goal:
  deployment boundary is LAN/VPN only.
- No persistent auth tokens.
- No server-side storage for secrets, authority state, or data required for system integrity.
- Server-side storage is allowed only for low-sensitivity, loss-tolerant UX state in authenticated single-user mode.
