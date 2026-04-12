# Roadmap

Planning notes, release steps, and historical roadmap snapshots moved out of AGENTS.md so AGENTS can stay focused on the current model, invariants, and guardrails.

## Project status
The original user-facing functional scope for NAS media-linking is now effectively closed in the current baseline: browsing, matching, linking, saved templates, auth/session flow, and the DSM-hosted deployment path are all present. The remaining roadmap items are refinement, bilingual publication, and hardening rather than core capability delivery.

## Roadmap (v1.1)
### Step: NAS-hosted always-on mode (no custom containers)
Этот step фиксирует целевую эксплуатацию без ручного локального старта: helper работает на NAS как внутренний сервис для устройств в домашней сети и через WireGuard. Шаг не меняет non-goals (публичный доступ не допускается), а добавляет/уточняет guardrails для безопасного self-hosted режима с минимальной инфраструктурой DSM.

```yaml
- action: add
  name: Network perimeter (LAN + WireGuard only)
  scope: Deployment (NAS/Router)
  type: Hard
  enforced: DSM firewall + router rules
  failure_mode: helper/API exposed to public internet
  rationale:
    risk_addressed: unauthorized remote access
    why_this_constraint: NAS-hosted mode must stay private-network only
    tradeoff: service unavailable outside LAN/VPN

- action: add
  name: No WAN port-forwarding and no UPnP for helper port
  scope: Deployment (Router)
  type: Hard
  enforced: router config
  failure_mode: accidental public exposure after router change
  rationale:
    risk_addressed: unintended internet publish
    why_this_constraint: protects against auto/manual external mapping
    tradeoff: external access only through WireGuard

- action: add
  name: Additional app-level auth in NAS-hosted mode
  scope: Helper or reverse proxy
  type: Hard
  enforced: helper and/or proxy
  failure_mode: any LAN/VPN client can trigger link actions
  rationale:
    risk_addressed: lateral access from trusted network segments
    why_this_constraint: runtime token in delivered HTML is not enough as primary auth
    tradeoff: one extra login step

- action: add
  name: Credentials as hash in env (no plaintext in code/repo)
  scope: Helper
  type: Hard
  enforced: helper
  failure_mode: credential leakage via source/logs
  rationale:
    risk_addressed: secret exposure
    why_this_constraint: reduces impact of code/log disclosure
    tradeoff: setup complexity (hash generation/rotation)

- action: update
  target: Auth token (x-run-token must match runtime token)
  change: keep as secondary request-binding control; do not rely on it as sole auth in NAS-hosted mode
  rationale:
    risk_addressed: token reuse by any client that can load UI
    why_this_constraint: explicit auth should be primary gate for multi-device private network usage
    tradeoff: two security layers to maintain

- action: record
  artifact: ADR / ops convention
  name: Baseline deployment without custom containers
  scope: Ops (DSM)
  guardrail_status: not_a_guardrail
  decision:
    - prefer Node.js package + Task Scheduler on DSM for v1.1
    - avoid custom container layer unless a concrete operational gap appears
  rationale:
    risk_addressed: over-complicated self-hosting
    why_this_decision: minimal ops path is enough for target usage
    tradeoff: less isolation than containerized deployment
```

### v1.1 migration profile
Historical migration profile for the retired pre-Node execution model. It records the transition from `local helper on Mac -> SSH -> NAS bash` to `NAS-hosted always-on helper on DSM` without changing the user-facing API.

```yaml
- phase: freeze_execution_semantics
  objective:
    - keep current API contracts and UI behavior unchanged
    - keep bash script as source of execution truth for v1.1
  invariant:
    - no direct local execution path added in v1.1
    - helper still invokes the canonical bash entrypoint
  rationale:
    why_this_phase: deployment migration must not silently become execution migration
    tradeoff: the then-current same-host SSH loopback was transitional and operationally inelegant

- phase: move_helper_to_dsm
  objective:
    - run helper as an always-on DSM-managed Node process
    - remove dependency on manual local startup from operator workstation
  runtime_model:
    process_owner: dedicated DSM user with least privilege
    startup: DSM Task Scheduler at boot
    app_dir: managed folder on NAS filesystem
    config_source: env file or Task Scheduler env export
  invariant:
    - helper remains internal service for LAN/WireGuard only
    - helper binds to localhost on NAS; external reachability is via DSM reverse proxy only

- phase: add_primary_auth_layer
  objective:
    - add explicit app/proxy auth suitable for private multi-device access
  invariant:
    - x-run-token remains secondary request-binding control
    - runtime token alone is not sufficient as the only gate in NAS-hosted mode
  validation:
    - unauthenticated browser cannot trigger link/list/search endpoints
    - authenticated flow still receives runtime token in delivered HTML

- phase: cutover_validation
  objective:
    - prove that NAS-hosted mode is operationally stable before calling v1.1 done
  checks:
    - service survives DSM reboot
    - LAN access works
    - WireGuard access works
    - no WAN exposure
    - logs are inspectable on NAS
    - rollback to workstation-hosted helper remains possible

- phase: release_state
  objective:
    - mark v1.1 complete only after real reboot-smoke-test passes in target DSM deployment
  completion_status:
    state: done
    evidence:
      - helper restarts automatically after DSM reboot
      - reverse proxy entry works on canonical host without custom port
      - unauthenticated browser does not receive operational app shell
      - core UI and API flows succeed after reboot
```

### DSM integration model for v1.1
Это не новый domain concept, а ops convention, совместимый с текущими guardrails.

```yaml
runtime_topology:
  helper:
    host: DSM
    bind: 127.0.0.1:8787
    process_manager: DSM Task Scheduler
    language_runtime: Synology Node.js package
  reverse_proxy:
    host: DSM Login Portal / Reverse Proxy
    upstream: 127.0.0.1:8787
    exposure: LAN + WireGuard only
  executor:
    status: retired_historical_path
    path: helper -> SSH(loopback or NAS LAN IP) -> /bin/bash linkmedia.sh
    reason: preserved execution semantics during the v1.1 -> v1.2 migration window

configuration_split:
  in_repo:
    - code
    - guardrails
    - documented env names
  on_dsm_only:
    - secrets
    - hashed credentials
    - runtime env values
    - reverse proxy mapping
    - firewall rules

ops_constraints:
  - do not expose helper port directly to WAN
  - do not rely on DSM reverse proxy alone as identity proof unless explicit auth is added there
  - prefer runtime user with least privilege over admin/root execution
  - prefer explicit lifecycle scripts over direct Task Scheduler command duplication
  - prefer one boot task and one manual restart task over multiple hidden DSM automations

historical_rollback_model:
  trigger:
    - DSM deployment unstable
    - auth path incomplete
    - reverse proxy misconfiguration
  action:
    - stop DSM-hosted helper task
    - restore workstation-hosted helper path
  invariant:
    - execution path to linkmedia.sh remains available throughout v1.1
```

### Historical v1.1 Profile Snapshot
Historical deployment snapshot:

```yaml
status:
  roadmap_state: done
  helper_runtime: running on DSM
  runtime_user: movies_linker
  reverse_proxy: enabled
  transport: HTTP and HTTPS entry work through DSM reverse proxy
  canonical_entrypoint: https://nas-linker.home.arpa/
  app_auth: enabled in helper via login shell + helper-managed session
  lifecycle:
    boot: DSM boot task -> start-helper.sh
    manual_restart: DSM manual task -> restart-helper.sh
    deploy: DSM manual task -> deploy-helper.sh
    status: ops/dsm/status-helper.sh
  executor_path: helper -> SSH -> linkmedia.sh
  note: retained here only as historical deployment context; current runtime is node-only

notes:
  - helper direct port stays loopback-only
  - Task Scheduler "Run" is not treated as restart primitive
  - first-class ops interface for v1.1 is the lifecycle script set in ops/dsm
  - v1.1 is considered closed after real DSM reboot validation on the canonical reverse-proxy host
  - current auth/login UX is further refined by v1.5 session model, but deployment boundary remains the same
```

### Historical Post-Rollout Lessons (`v1.1`)
These are preserved operational findings from the real DSM cutover, not current guardrails.

```yaml
findings:
  - lifecycle must be treated as a first-class artifact; direct Task Scheduler "Run" is not a restart strategy
  - at that time, same-host SSH execution required a readable runtime-user private key
  - shell-sourced env files must be shell-safe:
      - values with spaces require double quotes
      - values with '$' require single quotes when no expansion is desired
  - reverse proxy smoke test is safer on a separate HTTP port first, before converging on canonical HTTPS hostname
  - early startup validation is preferable to deferred request-time failure for env/path issues
  - admin shell and runtime user shell are different operational contexts; process visibility and restart behavior depend on that boundary
```

## Roadmap (v1.2)
### Step: Node-native linker execution (deprecate bash logic)
Historical migration step for replacing the retired NAS bash execution path with the current Node.js executor while preserving API contracts and guardrails.

Current implementation checkpoint:

```yaml
- phase: v1.2-phase-1
  status: done
  executor_boundary:
    state: extracted into helper-facing executor module
  current_behavior:
    node:
      - default primary path
      - listdir uses local Node execution on DSM
      - linkmovie uses local Node execution on DSM
      - linkseason uses local Node execution on DSM
    retired_historical_context:
      - migration temporarily kept a bash/SSH path for parity and rollback confidence
  invariant:
    - API/UI contract remains unchanged
  validation_status:
    - listdir confirmed in real DSM runtime
    - linkmovie confirmed in real DSM runtime
    - linkseason confirmed in real DSM runtime
  automated_test_status:
    - node:test covers listdir/linkmovie/linkseason contracts and core guardrails on temp fixtures
    - historical migration included a temporary bash-vs-node parity harness, now retired
```

Completion state:

```yaml
- phase: v1.2-release-state
  status: done
  done_criteria_evidence:
    - Node executor is the default path in target deployment
    - API response shapes remain unchanged from frozen contracts
    - guardrails were preserved while path validation and allowlist behavior stayed in helper/node executor
    - migration-time parity evidence existed for listdir/linkmovie/linkseason
    - bash logic is no longer required for normal NAS-hosted operation
```

```yaml
- action: define
  name: Migration goal and quality criteria
  scope: Architecture
  type: Hard
  source_of_truth:
    - existing API contracts
    - existing guardrails
    - explicit non-goals
  quality_criteria:
    maintainability:
      - one primary implementation language for business logic (Node.js)
      - reduced shell-specific branching
      - deterministic error contracts
    extensibility:
      - new linking policies can be added without shell rewrites
      - operation logic is composable and testable
    predictability:
      - identical input produces identical output/exit semantics
      - stable response shape for UI

- action: freeze
  name: Operation contracts before migration
  scope: Helper API
  type: Hard
  enforced: helper
  contracts:
    link_movie:
      request: { src, title, year }
      response: { ok, code, stdout, stderr }
    link_season:
      request: { srcDir, title, season, year }
      response: { ok, code, stdout, stderr }
    list:
      request: { dir }
      response_ok: { ok, dir, items }
      response_error: { ok: false, error|stderr }
  failure_mode: accidental API drift during refactor
  rationale:
    risk_addressed: UI breakage
    why_this_constraint: migration must be transparent to caller
    tradeoff: internal implementation freedom is limited by contract

- action: add
  name: Node executor parity layer
  scope: NAS execution path
  type: Hard
  enforced: helper
  requirements:
    - implement Node equivalents for linkmovie/linkseason/listdir
    - preserve path boundary checks and allowlist behavior
    - preserve spaces in paths
    - keep stdout/stderr/code semantics compatible with current UI handling
  failure_mode: behavior mismatch vs current production flow
  rationale:
    risk_addressed: migration regressions
    why_this_constraint: parity-first avoids hidden UX/API changes
    tradeoff: initial implementation may be less elegant than greenfield

- action: add
  name: Dual-run verification phase
  scope: Validation
  type: Hard
  enforced: CI/local test harness
  requirements:
    - for representative fixtures, compare bash vs Node outputs
    - compare: created links, destination paths, stdout/stderr text class, exit code mapping
    - include edge cases: path with '..' inside name, true traversal '/../', zero/multi file movie dir
  failure_mode: silent semantic drift
  rationale:
    risk_addressed: non-obvious incompatibilities
    why_this_constraint: migration confidence must be evidence-based
  tradeoff: temporary duplicated execution cost

- action: add
  name: Cutover + rollback switch
  scope: Runtime configuration
  type: Hard
  enforced: helper
  requirements:
    - feature flag to choose executor: bash | node
    - default to node only after parity criteria pass
    - one-command rollback to bash path
  failure_mode: no safe fallback during incidents
  rationale:
    risk_addressed: outage during rollout
    why_this_constraint: operational reversibility is mandatory
    tradeoff: short-term migration complexity from temporary dual-path support

- action: update
  target: listdir output format (type|name|size|mtime)
  change: enforcement source moved from linkmedia.sh to helper/node executor after cutover
  rationale:
    risk_addressed: parser instability in UI
    why_this_constraint: format remains invariant despite implementation change
    tradeoff: guardrail ownership changes

- action: update
  target: SSH execution via /bin/bash
  change: historical migration temporarily retained it while the primary path became local Node execution on NAS-hosted mode
  rationale:
    risk_addressed: unnecessary shell dependency
    why_this_constraint: reduce runtime coupling to bash semantics
    tradeoff: temporary two-path migration period

- action: define
  name: Done criteria for v1.2
  scope: Release gate
  type: Hard
  done_when:
    - Node executor is default path in target deployment
    - API response shapes unchanged from frozen contracts
    - guardrails preserved or strengthened (no invariant weakening)
    - migration-time parity evidence exists for critical operations
    - bash logic no longer required for normal operation
  failure_mode: incomplete migration declared as finished
  rationale:
    risk_addressed: ambiguous project state
    why_this_constraint: future resume should not require tribal knowledge
    tradeoff: stricter release gate
```

## Roadmap (v1.3)
### Step: UI/ops polish for responsiveness and deploy speed
Цель шага: улучшить UX предсказуемость и локальный dev/deploy цикл без размывания текущих инвариантов.

Current implementation checkpoint:

```yaml
- phase: v1.3-phase-1
  status: done
  delivered:
    - operation log moved from always-visible page block into explicit dialog surface
    - main screen keeps only a lightweight `View log` entrypoint in the header
  invariant:
    - log semantics unchanged; only the UI surface changed

- phase: v1.3-phase-2
  status: done
  delivered:
    - GLSL background animation pauses on tab hide and window blur
    - GLSL animation resumes on visibility return or window focus without time jump
  invariant:
    - visual background remains decorative and non-authoritative; pause/resume changes only resource usage

- phase: v1.3-phase-3
  status: done
  delivered:
    - core UI assets are built through Vite into helper-served files under `dist/app`
    - target UI no longer depends on external CDN availability for Tailwind or Shoelace runtime assets
    - runtime HTML remains helper-templated; build output affects only static UI assets
  invariant:
    - helper always serves local built assets; build strategy may evolve separately without changing runtime asset contract
```

```yaml
- action: add
  name: Optional server-side storage for low-sensitivity UX state
  scope: Helper storage + UI sync
  type: Hard
  enforced: helper + UI
  constraints:
    - store only low-sensitivity, loss-tolerant convenience state
    - core linking workflow must remain functional if storage is empty/unavailable
    - authenticated NAS-hosted single-user mode only
    - storage must not become authority for media/link integrity
  validation_strategy:
    - CRUD test for saved templates/preferences
    - restart persistence test
    - unauthenticated access denied test
    - explicit degraded UX when storage unavailable or reset
  rationale:
    risk_addressed: cross-browser/device UX friction after NAS-hosted rollout
    why_this_constraint: convenience sync is now justified, but only inside explicit boundaries
    tradeoff: introduces a small persistent state surface on the helper
  storage_contract:
    backend: sqlite
    initial_scope:
      - saved templates only
    schema:
      table: saved_templates
      columns:
        - id TEXT PRIMARY KEY
        - kind TEXT NOT NULL
        - title TEXT NOT NULL
        - year INTEGER NOT NULL
        - season INTEGER NULL
        - src_path TEXT NULL
        - created_at TEXT NOT NULL
        - updated_at TEXT NOT NULL
      uniqueness:
        - movie identity: (kind, title, year)
        - season identity: (kind, title, year, season)
    semantics:
      - save action is upsert by natural key, not append-only insert
      - src_path is editable convenience state and is not part of identity
      - UI does not need to retain server id in order to update a saved template
      - storage remains non-authoritative; user may always override form fields before link
    migration_behavior:
      - localStorage may be used as one-time bootstrap source
      - server store becomes canonical UX store after bootstrap
      - if bootstrap is skipped or fails, system still operates with empty server store
  api_contract:
    list_saved_templates:
      request: GET /api/saved-templates
      response_ok: { ok: true, items: [{ id, kind, title, year, season?, srcPath?, createdAt, updatedAt }] }
      response_error: { ok: false, error }
    upsert_saved_template:
      request: POST /api/saved-templates { kind, title, year, season?, srcPath? }
      response_ok: { ok: true, item: { id, kind, title, year, season?, srcPath?, createdAt, updatedAt } }
      response_error: { ok: false, error }
    delete_saved_template:
      request: POST /api/saved-templates/delete { id }
      response_ok: { ok: true }
      response_error: { ok: false, error }

- action: add
  name: Pause GLSL animation on tab/window blur
  scope: UI rendering loop
  type: Soft
  enforced: UI
  failure_mode: unnecessary CPU/GPU usage in background tab
  rationale:
    risk_addressed: resource waste and battery drain
    why_this_constraint: visual effect is non-critical when tab is not focused
    tradeoff: resume logic adds small state complexity
  acceptance:
    - animation loop pauses on `document.hidden=true` or `window.blur`
    - animation resumes on `visibilitychange` to visible or `window.focus`
    - no visual glitch on resume

- action: add
  name: Local static assets strategy with zero/near-zero deploy latency
  scope: UI asset delivery
  type: Hard
  enforced: helper + ops convention
  decision_candidates:
    - no-build local serving (vendor assets from controlled local path mapping)
    - minimal-build mode (single command, warm deploy in 1-2 seconds)
  constraints:
    - deterministic asset versions
    - no external CDN dependency for core controls in target mode
    - deployment command must be single-step
    - Local static assets is an exploratory decision; if cold start + first interaction exceeds ~1–2s, the approach is discarded.
  acceptance:
    - from clean working copy to runnable state with one command
    - expected readiness time in normal case <= 2 seconds
    - documented fallback path if fast mode unavailable

- action: add
  name: Move operation log into dialog
  scope: UI feedback surface
  type: Soft
  enforced: UI
  failure_mode: permanent log block clutters primary workflow
  rationale:
    risk_addressed: reduced signal-to-noise in main screen
    why_this_constraint: logs are secondary to linking actions
    tradeoff: one extra click to inspect details
  acceptance:
    - log panel replaced by button-triggered modal/dialog
    - clear-log action preserved
    - main screen keeps only a lightweight entrypoint for opening the log dialog
```

## Roadmap (v1.4)
### Step: Guardrails-to-tests and dev protocol cementing
Цель шага: после стабилизации основного инструмента закрепить инварианты в автотестах и стандартизировать workflow разработки, чтобы качество не зависело от памяти о прошлых решениях.

Current implementation checkpoint:

```yaml
- phase: v1.4-phase-1
  status: done
  release_interpretation: risk-based coverage baseline, not exhaustive test closure
  delivered:
    - `guardrail-test-mapping.md` maps repo-local Hard guardrails to automated evidence
    - stable Hard guardrails are covered in repo tests, except deployment-only controls that remain `ops-manual`
    - retired rollback-path guardrails are no longer part of the active runtime model
    - helper-level contracts are frozen by automated route tests for list/link/meta/ux-state APIs
    - local static asset bootstrap is covered up to helper-served runtime graph, without requiring external CDN access
    - path validation now allows printable Unicode paths while preserving traversal and control-character rejection
  stop_rule:
    done_when:
      - every repo-local Hard guardrail is `covered` or consciously classified as `ops-manual`
      - remaining gaps are documented as optional hardening rather than release blockers
      - full suite stays green
  current_suite_status:
    tests: 63
    state: passing

- phase: v1.4-optional-hardening
  status: backlog
  non_blocking_items:
    - true headless-browser E2E beyond helper-level/runtime-bootstrap smoke
    - broader auth/token route parity beyond current boundary coverage
    - additional process-level startup/config edge cases
    - deeper rollback-path edge fixtures
    - deeper normalization/spoofing hardening beyond the current printable-Unicode path model
```

```yaml
- action: add
  name: Convert guardrails into automated tests
  scope: QA/CI
  type: Hard
  enforced: test suite
  failure_mode: guardrails exist only as documentation and drift from implementation
  rationale:
    risk_addressed: invariant regression during iterative changes
    why_this_constraint: critical constraints must be machine-checked
    tradeoff: upfront test maintenance effort
  acceptance:
    - every Hard guardrail mapped to at least one automated test
    - failing guardrail test blocks release
    - mapping table `guardrail -> test id` is documented in repo

- action: add
  name: Standard dev protocol (feature -> guardrails -> tests)
  scope: Process
  type: Hard
  enforced: contribution workflow
  failure_mode: ad-hoc development with missing invariants/tests
  rationale:
    risk_addressed: non-repeatable quality and implicit decisions
    why_this_constraint: process must preserve intent over time
    tradeoff: slower initial implementation for new features
  protocol:
    1: implement feature increment
    2: capture observed constraints and edge-cases as guardrails
    3: freeze relevant contracts/invariants
    4: encode guardrails as automated tests
    5: run test gate before merge/release
  acceptance:
    - new feature PR includes guardrail updates when behavior assumptions are introduced
    - guardrail changes include corresponding test additions/updates
    - release checklist includes protocol compliance check
```

## Roadmap (v1.5)
### Step: Session-aware UX, app auth surface, and NAS-native deploy ergonomics
Цель шага: убрать текущее трение NAS-hosted режима по трём направлениям без размывания существующих инвариантов:
- UI должен явно переживать потерю auth/runtime session вместо частичной поломки;
- auth UX должен перейти от browser-native Basic Auth к управляемой app-level session модели;
- deploy/update flow должен выполняться целиком на NAS без локального UI build.

Current implementation checkpoint:

```yaml
- phase: v1.5-phase-1
  name: Session-aware UI
  status: done
  objective:
    - detect stale runtime token or lost auth explicitly in UI
    - replace silent partial breakage with clear reload/login prompt
  scope:
    - client fetch wrappers
    - status/dialog surface
  delivered:
    - API requests are centralized through UI wrappers that treat `401/403` as session loss
    - page opens explicit recovery dialog instead of drifting into partial broken state
    - auth loss and stale runtime-token loss are distinguished heuristically via response headers
  invariant:
    - existing API contracts remain unchanged
    - `x-run-token` remains in place
    - current auth mechanism may stay temporarily unchanged while UI handling improves
  validation_strategy:
    - helper restart with open page leads to explicit reload/session-expired prompt
    - `401/403` from API does not leave page in partially broken state
    - user can recover with one obvious action (`Reload` or re-login)

- phase: v1.5-phase-2
  name: App login/session surface
  status: done
  objective:
    - replace browser-native Basic Auth as primary UX layer
    - move to explicit app login and controlled session lifecycle
  target_model:
    entrypoint_behavior:
      authenticated:
        - `GET /` returns the normal app shell
      unauthenticated:
        - `GET /` returns a dedicated login shell instead of the operational app UI
    session_endpoints:
      - `POST /api/session/login { username, password }`
      - `POST /api/session/logout`
      - `GET /api/session`
    primary_auth:
      - login form served by helper
      - short-lived helper-managed session
      - httpOnly cookie transport
    session_store:
      persistence: in-memory only
      topology: single helper process
      expected_shape:
        - one active session or a very small session map is sufficient
      ttl:
        absolute_lifetime: 8-12h target range
        idle_timeout: ~2h target range
      invalidation:
        - explicit logout
        - helper restart
        - session timeout
    cookie_policy:
      - HttpOnly
      - Secure on HTTPS entrypoint
      - SameSite=Strict
      - Path=/
    secondary_binding:
      - `x-run-token` stays as request-binding control for delivered page
  invariant:
    - no persistent auth tokens
    - unauthenticated browser still cannot invoke helper APIs
    - logout and expired-session handling become explicit UI states
    - browser-native Basic Auth prompt is no longer part of normal user flow
  delivered:
    - helper serves login shell for unauthenticated `/`
    - helper-managed in-memory session is issued via httpOnly cookie
    - login/logout/session endpoints are active
    - app shell keeps `x-run-token` as secondary request-binding control
    - browser keychain/password-manager integration becomes available through normal login form UX
  validation_strategy:
    - unauthenticated access sees login screen, not partial app shell
    - successful login enables normal UI/API flow
    - logout revokes access without browser-specific Basic Auth quirks
    - expired session returns user to clear login/recovery path
  done_criteria:
    - opening `/` without a valid session shows login shell
    - authenticated session reaches current app shell without browser-native Basic Auth prompt
    - `POST /api/session/logout` reliably returns user to unauthenticated state
    - helper restart invalidates session cleanly and recovery path remains explicit
    - `x-run-token` remains required for operational API calls after login

- phase: v1.5-phase-3
  name: NAS-side deploy/build flow
  status: done
  objective:
    - allow full update/build/restart cycle to run on NAS
    - remove need for local UI build before deploy
  ops_model:
    start_path:
      - `start-helper.sh` remains runtime-only
      - `restart-helper.sh` remains runtime-only
    deploy_path:
      - dedicated `deploy-helper.sh` performs dependency install, UI build, then restart
  delivered:
    - DSM ops layer now includes a dedicated deploy script separate from start/restart
    - runtime recovery scripts remain build-free
    - `deploy-helper.sh` performs `npm ci`, `npm run build:ui`, then restart
    - lifecycle scripts are serialized via an ops lock so deploy/restart do not race each other
  invariant:
    - boot/start path must not depend on build step
    - deploy/update path may depend on full Node toolchain on NAS
    - runtime recovery and asset compilation remain separate concerns
  validation_strategy:
    - deploy script updates deps, builds UI, restarts helper in one command
    - boot task still starts previously built app without invoking build
    - failed build does not masquerade as normal runtime restart failure
  done_criteria:
    - canonical DSM update path is `deploy-helper.sh`
    - user-validated NAS run confirms `npm ci`, `npm run build:ui`, and restart succeed on target
    - concurrent lifecycle actions fail fast instead of racing

- phase: v1.5-release-state
  status: done
  done_criteria_evidence:
    - session-aware UI surfaces auth/runtime loss explicitly instead of partial silent breakage
    - helper-managed login/session replaces browser-native Basic Auth for normal user flow
    - password-manager/keychain flow works through the login shell
    - canonical DSM deploy path can run fully on NAS via `deploy-helper.sh`
    - lifecycle lock prevents deploy/restart races during DSM task execution
```

```yaml
- action: add
  name: Explicit stale-session handling in UI
  scope: UI + helper response handling
  type: Hard
  enforced: UI
  failure_mode: helper restart or auth loss leaves page partially broken until manual hard refresh
  rationale:
    risk_addressed: ambiguous failure state in NAS-hosted always-on usage
    why_this_constraint: session loss must be explicit, recoverable, and visible
    tradeoff: one more global error/recovery surface in UI
  acceptance:
    - `401` or `403` from API leads to explicit blocking recovery UI
    - recovery UI distinguishes stale session from generic request failure where possible
    - partial broken state without visible recovery path is not allowed

- action: add
  name: App-managed session replaces Basic Auth as primary user-facing gate
  scope: Helper auth + UI shell
  type: Hard
  enforced: helper + UI
  rationale:
    risk_addressed: browser-specific Basic Auth caching and poor logout/session UX
    why_this_constraint: auth must be explicit and predictable in multi-browser private-network use
    tradeoff: helper must own login/logout/session lifecycle
  constraints:
    - no persistent auth tokens
    - session must be short-lived and helper-managed
    - browser must not need native Basic Auth prompt for normal operation
    - session cookie must be httpOnly and not readable from UI code
    - helper restart may invalidate session; UI must treat this as a recoverable state
  acceptance:
    - login screen is first-class app surface
    - logout is explicit and reliable
    - session expiry is represented in UI, not as browser-native auth confusion
    - operational app shell is never served to unauthenticated browser state

- action: add
  name: Dedicated NAS deploy script with on-box UI build
  scope: Ops / DSM lifecycle
  type: Hard
  enforced: ops convention
  rationale:
    risk_addressed: split-brain deployment flow between local build and NAS runtime
    why_this_constraint: deploy should be executable entirely from target NAS when desired
    tradeoff: NAS checkout keeps full Node toolchain and build dependencies
  constraints:
    - build must not be embedded into normal boot/start path
    - deploy/update script may run `npm ci`, `npm run build:ui`, then restart
    - restart path must stay fast and runtime-focused
  acceptance:
    - canonical DSM update path is one deploy script
    - canonical DSM boot path stays build-free
    - docs clearly distinguish start/restart from deploy/update
```

## Roadmap (v1.6)
### Step: Bilingual publication and lightweight UI i18n
Цель шага: сделать проект publishable на английском и русском без тяжёлого i18n framework и без смешения языков в одном и том же слое. Репозиторий и public docs должны стать предсказуемыми для внешнего читателя, а UI должен получить минимальный, но явный locale layer для user-facing текста.

Delivery checkpoint:

```yaml
- phase: v1.6-phase-1
  name: Language policy and scope freeze
  status: done
  objective:
    - define a stable bilingual publication model before code extraction starts
    - prevent ad-hoc mixing of Russian and English across UI, docs, and internal artifacts
  target_policy:
    repository_docs:
      primary_language: English
      secondary_language: Russian via explicit companion docs
    ui:
      supported_locales: [en, ru]
      translation_scope: user-facing labels, headings, hints, empty states, dialogs
    internal_artifacts:
      initial_scope:
        - server logs stay untranslated
        - low-level backend errors stay untranslated unless surfaced through UI mapping
        - historical notes are not a release blocker for translation
  invariant:
    - one surface should not mix English and Russian arbitrarily
    - i18n rollout must start from explicit scope boundaries, not from opportunistic string edits

- phase: v1.6-phase-2
  name: Lightweight UI i18n layer
  status: done
  objective:
    - add minimal locale infrastructure in `src/ui` without introducing a heavy dependency
  target_model:
    runtime:
      locale_source_priority:
        - explicit user choice
        - localStorage
        - navigator.language
        - fallback: en
      storage:
        - selected locale may persist in localStorage as low-sensitivity preference
    implementation:
      - translations live in a small in-repo dictionary
      - UI code references keys, not inline user-facing strings
      - templates remain shell-oriented and do not become translation-authority files
    supported_controls:
      - explicit language switcher in the app header
      - same switcher or equivalent entrypoint on the login surface when practical
  invariant:
    - locale choice is explicit and reversible
    - absence of saved locale must degrade to deterministic fallback (`en`)

- phase: v1.6-phase-3
  name: Public docs bilingualization
  status: done
  objective:
    - make repository entry docs presentable to English-speaking and Russian-speaking readers
  delivered_when_done:
    - `README.md` is English-first
    - `README.ru.md` exists as explicit Russian companion
    - both files link to each other near the top
    - public setup narrative does not require reading mixed-language sections
  invariant:
    - bilingual docs use separate files, not mixed-language paragraphs in one README

- phase: v1.6-phase-4
  name: Incremental extraction and validation
  status: done
  objective:
    - migrate existing UI strings into translation keys with minimal behavior drift
  validation_strategy:
    - English fallback renders complete app shell and login shell without missing keys
    - Russian locale renders the same user flows without layout regressions in key screens
    - switching locale does not affect auth/session or API behavior
    - missing translation keys fail visibly in development
  done_criteria:
    - primary app shell and login shell support `en` and `ru`
    - header actions, section titles, subheaders, dialogs, and empty states are localized
    - README pair exists and is cross-linked
    - no heavy external i18n framework was needed for the initial bilingual release
```

This checkpoint is now closed for the current baseline: bilingual docs, locale switching, translation hooks, and regression coverage are in place. Any remaining work in this area should be treated as incremental polish or future expansion, not core v1.6 delivery.

```yaml
- action: add
  name: English-first repository publication model
  scope: Public docs
  type: Hard
  enforced: documentation convention
  rationale:
    risk_addressed: mixed-language public surface that feels accidental rather than bilingual
    why_this_constraint: publication quality depends on explicit audience-facing language policy
    tradeoff: docs maintenance now has two explicit tracks
  acceptance:
    - canonical public README is English
    - Russian companion README is explicit and discoverable
    - repository landing surface avoids mixed-language narrative blocks

- action: add
  name: Lightweight UI translation dictionary for user-facing strings
  scope: UI
  type: Hard
  enforced: UI implementation convention
  rationale:
    risk_addressed: uncontrolled string duplication and partial translation drift
    why_this_constraint: current UI text volume does not justify a heavy i18n framework
    tradeoff: early translation tooling stays intentionally simple
  constraints:
    - first pass localizes only user-facing UI copy
    - strings are addressed by keys, not duplicated inline literals
    - locale fallback must be deterministic
    - templates should not become the primary translation store
  acceptance:
    - app shell and login shell can render from translation keys
    - locale switching requires no server restart or rebuild-time forked templates

- action: add
  name: Explicit locale switcher and persisted user preference
  scope: UI
  type: Soft
  enforced: UI
  rationale:
    risk_addressed: hidden language choice based only on browser heuristics
    why_this_constraint: bilingual publication should remain user-controlled
    tradeoff: one more small control in the UI chrome
  constraints:
    - user may override detected locale manually
    - chosen locale may persist as low-sensitivity preference
    - no locale choice should be required before the page becomes usable
  acceptance:
    - locale can be switched without re-auth flow changes
    - saved choice survives reload

- action: freeze
  name: Initial i18n non-goals
  scope: Architecture / release scope
  type: Hard
  enforced: roadmap discipline
  rationale:
    risk_addressed: scope creep into full localization platform work
    why_this_constraint: the first bilingual release should optimize for clarity and DX, not completeness
    tradeoff: some text remains English-only or untranslated temporarily
  non_goals:
    - no server-side locale negotiation in the first pass
    - no localization of low-level logs or internal executor errors in the first pass
    - no pluralization engine unless a concrete UI need appears
    - no framework migration motivated only by i18n concerns
```
