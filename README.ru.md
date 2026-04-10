# nas-linker

[English version](./README.md)

Helper-сервис для преобразования торрент-папок на Synology NAS в детерминированную структуру hardlink-файлов для фильмов и сериалов, которую Plex может стабильно индексировать.

Инструмент отдаёт browser UI, валидирует пути на сервере и выполняет операции линковки прямо на NAS. В текущем baseline:

- основной execution path это локальный Node.js на NAS
- аутентификация построена на app-managed login/session плюс runtime request-binding token
- saved templates хранятся как low-sensitivity UX state в sqlite

## Что Делает

- Линкует одиночную папку фильма в нормализованную movie layout
- Линкует папку сезона в нормализованную TV layout, пропуская совпадающие basenames вместо перезаписи файлов в сезоне
- Даёт возможность просматривать ограниченное подмножество папок NAS из UI
- Сохраняет переиспользуемые шаблоны для быстрого повторного линкования
- Опционально проксирует metadata search через Plex Discover / OMDb, не раскрывая токены браузеру

## Что Не Делает

- Это не torrent client
- Это не media player и не library manager
- Это не multi-user продукт
- Сервис не предназначен для публикации в открытый интернет

## Runtime Model

- Browser UI -> Express helper
- Helper валидирует запросы и enforce-ит auth
- Helper выполняет linker logic локально на NAS через встроенный Node executor

## Security / Scope Notes

- Целевая граница деплоя: только LAN или VPN
- `x-run-token` это вторичный request-binding layer, а не primary auth boundary
- Metadata tokens остаются на серверной стороне
- Server-side UX state это только convenience layer; он должен оставаться low-sensitivity и loss-tolerant

## Requirements

- Node.js 22 предпочтительно
- Synology NAS или другой host с тем же path model
- Writable location для:
  - checkout приложения
  - sqlite UX-state DB
  - logs / PID / lock files
- Опционально для metadata search:
  - Plex Discover token
  - OMDb API key

## Quick Start

### Локальный UI debug mode

Используй это, если нужно просто поднять страницу локально для UI/styling work и не нужен production-like DSM setup.

1. Установи зависимости:

```sh
npm ci
```

2. Собери UI assets:

```sh
npm run build:ui
```

3. Запусти сервер напрямую:

```sh
node --experimental-sqlite server.mjs
```

4. Открой `http://127.0.0.1:8787`.

Примечания:

- это debug/preview path, а не canonical deployment model
- auth отключён, если одновременно не заданы `APP_AUTH_USER` и `APP_AUTH_PASSWORD_HASH`
- metadata search и реальные NAS operations могут быть недоступны или лишь частично репрезентативны без соответствующего env/path setup
- после frontend changes, влияющих на served bundle, UI assets нужно пересобирать через `npm run build:ui`

### Локальный server mode с явным env

Используй этот режим, если нужен более полный локальный запуск сервера со своими export-нутыми env values.

1. Установи зависимости:

```sh
npm ci
```

2. Собери UI assets:

```sh
npm run build:ui
```

3. Отредактируй env values или export-ни их в shell. Отслеживаемый [`run.sh`](./run.sh) это placeholder-based launcher, а не secret store.

4. Запусти helper:

```sh
./run.sh
```

### DSM-hosted mode

Operational details описаны в [ops/dsm/README.md](./ops/dsm/README.md).

High-level flow:

1. Скопируй репозиторий на NAS.
2. Создай `ops/dsm/nas-linker.env` на основе [`ops/dsm/nas-linker.env.example`](./ops/dsm/nas-linker.env.example).
3. Запусти deploy прямо на NAS:

```sh
/volume1/scripts/nas-linker/ops/dsm/deploy-helper.sh
```

4. Опубликуй helper через DSM reverse proxy.
5. Используй boot task для `start-helper.sh` и manual task для `restart-helper.sh`.

Опциональный локальный wrapper для deploy:

```sh
./deploy-local.sh
```

Он синхронизирует checkout на `movies_linker@synology.local` по SSH и затем запускает существующий DSM deploy-script на месте от того же runtime user. Если нужен явный путь к helper-скрипту, `./ops/remote/deploy-helper.sh` делает то же самое.

## Minimal Env Surface

Основные env:

- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD_HASH`
- `UX_STATE_DB_PATH` (опционально; по умолчанию под `data/ux-state.sqlite`)

Опционально для metadata search:

- `PLEX_DISCOVER_TOKEN`
- `OMDB_API_KEY`

## Auth Setup

App login использует:

- `APP_AUTH_USER`
- `APP_AUTH_PASSWORD_HASH`

`APP_AUTH_PASSWORD_HASH` должен быть в таком формате:

```text
scrypt$N$r$p$salt$hash
```

Сгенерировать можно через Node:

```sh
node -e 'const crypto=require("node:crypto"); const password=process.argv[1]; const salt=crypto.randomBytes(16).toString("hex"); const N=16384,r=8,p=1; const hash=crypto.scryptSync(password, salt, 32, {N,r,p}).toString("hex"); console.log(`scrypt$${N}$${r}$${p}$${salt}$${hash}`);' 'your_password_here'
```

Потом положи результат в env, используя одинарные кавычки:

```sh
APP_AUTH_USER="your_user"
APP_AUTH_PASSWORD_HASH='scrypt$16384$8$1$...'
```

## Metadata Setup

Metadata search опционален. Базовые linking и folder browsing работают и без него.

### Plex Discover

`PLEX_DISCOVER_TOKEN` нужен только если ты хочешь, чтобы `/api/meta/search` использовал Plex Discover.

- Локальная установка Plex Media Server не нужна для core linker
- Для metadata search нужен account token Plex, который helper будет использовать server-side
- Plex описывает, как найти `X-Plex-Token`, здесь:
  - [Finding an authentication token / X-Plex-Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)

### OMDb

`OMDB_API_KEY` опционален. Он используется только для обогащения search results постерами, когда OMDb может их вернуть.

- Без `OMDB_API_KEY` линковка всё равно работает
- Без него metadata results могут просто остаться без postер enrichment
- Домашняя страница API и информация про ключ:
  - [OMDb API](https://www.omdbapi.com/)

## Repository Layout

- [`server.mjs`](./server.mjs) - canonical server entrypoint
- [`helper.mjs`](./helper.mjs) - compatibility shim для legacy entrypoint name
- [`src/server/app.mjs`](./src/server/app.mjs) - Express bootstrap и wiring зависимостей
- [`src/server/config.mjs`](./src/server/config.mjs) - runtime env parsing и сборка default dependency graph
- [`src/server/auth/`](./src/server/auth) - auth modules для session и runtime-token request binding
- [`src/server/routes/index.mjs`](./src/server/routes/index.mjs) - верхнеуровневая композиция routes
- [`src/server/routes/`](./src/server/routes) - route modules, разделённые по session, linking, metadata, saved templates и shell
- [`src/server/metadata/`](./src/server/metadata) - Plex Discover и OMDb metadata helpers
- [`src/server/ui/`](./src/server/ui) - загрузка HTML shell-ов и token/template injection
- [`src/core/executor.mjs`](./src/core/executor.mjs) - основной Node executor и path guardrails
- [`src/core/saved-templates-store.mjs`](./src/core/saved-templates-store.mjs) - sqlite-backed storage для saved templates
- [`src/templates/app-shell.html`](./src/templates/app-shell.html) - шаблон authenticated app shell
- [`src/templates/login-shell.html`](./src/templates/login-shell.html) - шаблон unauthenticated login shell
- [`src/ui/`](./src/ui) - Vite UI source
- [`dist/app/`](./dist/app) - собранные UI assets, которые helper раздаёт по `/assets/app/...`
- [`assets/vendor/`](./assets/vendor) - checked-in vendor static assets, которые раздаются по `/assets/vendor/...`
- [`docs/roadmap.md`](./docs/roadmap.md) - planning notes, release steps и historical roadmap snapshots
- [`ops/dsm/`](./ops/dsm) - DSM lifecycle и deploy scripts
- [`test/`](./test) - automated tests

## Tests

```sh
npm test
```

Test suite покрывает executor behavior, helper API contracts, auth/session boundaries, token non-leakage и static-asset bootstrap.

## Publication Notes

- Не коммить заполненные env files или runtime sqlite state
- Если планируешь публиковать чистую публичную историю, проверь старые commits на локальные infra identifiers и ранее закоммиченные tokens/API keys
- Текущие docs содержат Synology-specific примеры; воспринимай их как deployment examples, а не как обязательную product semantics
