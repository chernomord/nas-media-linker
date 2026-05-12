import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { createExecutor, TORRENTS_ROOT } from "../src/core/executor.mjs";
import { createSavedTemplatesStore } from "../src/core/saved-templates-store.mjs";
import { createApp } from "../server.mjs";

function createPasswordHash(password) {
  const salt = "0123456789abcdef";
  const N = 16384;
  const r = 8;
  const p = 1;
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function authHeaders({ runToken = null, cookie = null } = {}) {
  const headers = {};
  if (runToken) headers["x-run-token"] = runToken;
  if (cookie) headers.cookie = cookie;
  return headers;
}

async function loginSession(baseUrl, { username = "operator", password = "secret" } = {}) {
  const resp = await fetch(`${baseUrl}/api/session/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await resp.json().catch(() => ({}));
  const setCookie = resp.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";", 1)[0] : null;
  return { resp, data, cookie };
}

function makeSavedTemplatesStore(seedItems = []) {
  const items = [...seedItems];
  return {
    list() {
      return [...items];
    },
    upsert(input) {
      if (!input?.title) throw new Error("title required");
      const item = {
        id: input.id ?? "saved-1",
        kind: input.kind,
        title: input.title,
        year: Number(input.year),
        season: input.season == null ? null : Number(input.season),
        sourceId: input.sourceId ?? null,
        srcPath: input.srcPath ?? null,
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
      };
      items.splice(0, items.length, item);
      return item;
    },
    delete(id) {
      if (!id) throw new Error("id required");
      items.splice(0, items.length);
      return { ok: true };
    },
  };
}

async function makeSqliteSavedTemplatesStore() {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-helper-api-db-"));
  return {
    base,
    store: createSavedTemplatesStore({
      dbPath: path.join(base, "ux-state.sqlite"),
    }),
  };
}

function collectUsedShoelaceTags(source) {
  const tags = new Set();
  for (const match of source.matchAll(/<\s*(sl-[a-z0-9-]+)/g)) {
    tags.add(match[1]);
  }
  for (const match of source.matchAll(/createElement\("(sl-[a-z0-9-]+)"\)/g)) {
    tags.add(match[1]);
  }
  return [...tags].sort();
}

function collectDefinedShoelaceTags(bundleSource) {
  const tags = new Set();
  for (const match of bundleSource.matchAll(/(?:\.define|customElements\.define)\("(sl-[a-z0-9-]+)"/g)) {
    tags.add(match[1]);
  }
  return [...tags].sort();
}

function collectUiIconNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/setAttribute\("name",([^)]+)\)/g)) {
    for (const icon of match[1].matchAll(/"([a-z0-9-]+)"/g)) {
      if (icon[1].length >= 2) {
        names.add(icon[1]);
      }
    }
  }
  return [...names].sort();
}

test("root returns login shell when session auth is configured and no session exists", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/`);
    const html = await resp.text();
    assert.equal(resp.status, 200);
    assert.match(html, /Sign in to continue/);
    assert.match(html, /data-page-title-key="page\.login\.title"/);
    assert.match(html, /data-locale-switcher/);
    assert.match(html, /data-i18n="login\.title"/);
    assert.doesNotMatch(html, /data-run-token="test-token"/);
  });
});

test("createApp rejects incomplete app auth config", () => {
  assert.throws(
    () =>
      createApp({
        runToken: "test-token",
        appAuthUser: "operator",
        executor: {
          async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
          async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
          async listDir() { return { ok: true, code: 0, items: [] }; },
        },
        savedTemplatesStore: makeSavedTemplatesStore(),
      }),
    /APP_AUTH_USER and APP_AUTH_PASSWORD_HASH must be set together/,
  );
});

test("createApp rejects invalid app auth hash format", () => {
  assert.throws(
    () =>
      createApp({
        runToken: "test-token",
        appAuthUser: "operator",
        appAuthPasswordHash: "not-a-scrypt-hash",
        executor: {
          async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
          async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
          async listDir() { return { ok: true, code: 0, items: [] }; },
        },
        savedTemplatesStore: makeSavedTemplatesStore(),
      }),
    /APP_AUTH_PASSWORD_HASH must use scrypt\$N\$r\$p\$salt\$hash format/,
  );
});

test("api routes require x-run-token even after successful session login", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp: loginResp, cookie } = await loginSession(baseUrl);
    assert.equal(loginResp.status, 200);
    assert.ok(cookie);

    const resp = await fetch(`${baseUrl}/api/saved-templates`, {
      headers: authHeaders({ cookie }),
    });
    assert.equal(resp.status, 401);
  });
});

test("api routes reject wrong x-run-token", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp: loginResp, cookie } = await loginSession(baseUrl);
    assert.equal(loginResp.status, 200);
    assert.ok(cookie);

    const resp = await fetch(`${baseUrl}/api/saved-templates`, {
      headers: authHeaders({
        cookie,
        runToken: "wrong-token",
      }),
    });
    assert.equal(resp.status, 401);
    assert.equal(await resp.text(), "Unauthorized");
  });
});

test("session login rejects wrong password", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp, data, cookie } = await loginSession(baseUrl, {
      username: "operator",
      password: "wrong-secret",
    });
    assert.equal(resp.status, 401);
    assert.equal(resp.headers.get("x-nas-linker-auth"), "session");
    assert.deepEqual(data, { ok: false, error: "invalid credentials" });
    assert.equal(cookie, null);
  });
});

test("session login rejects wrong username", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp, data, cookie } = await loginSession(baseUrl, {
      username: "intruder",
      password: "secret",
    });
    assert.equal(resp.status, 401);
    assert.equal(resp.headers.get("x-nas-linker-auth"), "session");
    assert.deepEqual(data, { ok: false, error: "invalid credentials" });
    assert.equal(cookie, null);
  });
});

test("session login rejects missing credentials payload", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/session/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: "operator" }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "username and password required",
    });
  });
});

test("successful session login makes root return the app shell", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp: loginResp, cookie } = await loginSession(baseUrl);
    assert.equal(loginResp.status, 200);
    assert.ok(cookie);

    const resp = await fetch(`${baseUrl}/`, {
      headers: authHeaders({ cookie }),
    });
    const html = await resp.text();
    assert.equal(resp.status, 200);
    assert.match(html, /data-run-token="test-token"/);
    assert.match(html, /id="logout_btn"/);
    assert.match(html, /data-page-title-key="page\.app\.title"/);
    assert.match(html, /data-locale-switcher/);
    assert.match(html, /data-i18n="header\.title"/);
    assert.doesNotMatch(html, /Sign in to continue/);
  });
});

test("session logout clears access to the app shell and APIs", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const { resp: loginResp, cookie } = await loginSession(baseUrl);
    assert.equal(loginResp.status, 200);
    assert.ok(cookie);

    const logoutResp = await fetch(`${baseUrl}/api/session/logout`, {
      method: "POST",
      headers: authHeaders({ cookie, runToken: "test-token" }),
    });
    assert.equal(logoutResp.status, 200);
    assert.match(logoutResp.headers.get("set-cookie") || "", /Max-Age=0/);
    assert.deepEqual(await logoutResp.json(), {
      ok: true,
      authenticated: false,
    });

    const rootResp = await fetch(`${baseUrl}/`, {
      headers: authHeaders({ cookie }),
    });
    const rootHtml = await rootResp.text();
    assert.equal(rootResp.status, 200);
    assert.match(rootHtml, /Sign in to continue/);

    const apiResp = await fetch(`${baseUrl}/api/saved-templates`, {
      headers: authHeaders({ cookie, runToken: "test-token" }),
    });
    assert.equal(apiResp.status, 401);
    assert.equal(apiResp.headers.get("x-nas-linker-auth"), "session");
    assert.deepEqual(await apiResp.json(), {
      ok: false,
      error: "session required",
    });
  });
});

test("root html includes runtime token placeholder replacement", async () => {
  const app = createApp({
    runToken: "runtime-token-123",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/`);
    const html = await resp.text();
    assert.equal(resp.status, 200);
    assert.match(html, /data-run-token="runtime-token-123"/);
    assert.match(html, /id="session_modal"/);
    assert.match(html, /id="session_reload"/);
    assert.doesNotMatch(html, /X-Plex-Token/);
    assert.doesNotMatch(html, /PLEX_DISCOVER_TOKEN/);
  });
});

test("root html boots from local static assets without external CDN URLs", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const htmlResp = await fetch(`${baseUrl}/`);
    assert.equal(htmlResp.status, 200);
    const html = await htmlResp.text();

    assert.match(html, /href="\/assets\/app\/app\.css\?v=[^"]+"/);
    assert.match(html, /src="\/assets\/app\/app\.js\?v=[^"]+"/);
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|shoelace\.style|esm\.sh|tailwindcss\.com/);

    const cssResp = await fetch(`${baseUrl}/assets/app/app.css`);
    assert.equal(cssResp.status, 200);
    const css = await cssResp.text();
    assert.ok(css.length > 0);
    assert.doesNotMatch(css, /cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|shoelace\.style|esm\.sh|tailwindcss\.com/);

    const jsResp = await fetch(`${baseUrl}/assets/app/app.js`);
    assert.equal(jsResp.status, 200);
    const js = await jsResp.text();
    assert.ok(js.length > 0);
    assert.match(js, /\/assets\/vendor\/bootstrap-icons\/icons\//);
    assert.doesNotMatch(js, /cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|shoelace\.style|esm\.sh|tailwindcss\.com/);
  });
});

test("helper shells expose i18n hooks for title, locale switcher, and translated controls", async () => {
  const app = createApp({
    runToken: "test-token",
    appAuthUser: "operator",
    appAuthPasswordHash: createPasswordHash("secret"),
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const loginResp = await fetch(`${baseUrl}/`);
    assert.equal(loginResp.status, 200);
    const loginHtml = await loginResp.text();
    assert.match(loginHtml, /href="\/assets\/app\/app\.css\?v=[^"]+"/);
    assert.match(loginHtml, /src="\/assets\/app\/app\.js\?v=[^"]+"/);
    assert.match(loginHtml, /data-page-title-key="page\.login\.title"/);
    assert.match(loginHtml, /data-locale-switcher/);
    assert.match(loginHtml, /data-i18n="login\.submit"/);

    const { cookie } = await loginSession(baseUrl);
    assert.ok(cookie);

    const appResp = await fetch(`${baseUrl}/`, {
      headers: authHeaders({ cookie }),
    });
    assert.equal(appResp.status, 200);
    const appHtml = await appResp.text();
    assert.match(appHtml, /href="\/assets\/app\/app\.css\?v=[^"]+"/);
    assert.match(appHtml, /src="\/assets\/app\/app\.js\?v=[^"]+"/);
    assert.match(appHtml, /data-page-title-key="page\.app\.title"/);
    assert.match(appHtml, /data-locale-switcher/);
    assert.match(appHtml, /data-i18n="header\.view_log"/);
    assert.match(appHtml, /data-i18n-label="session\.dialog_label"/);
    assert.match(appHtml, /data-i18n="season\.reset_target"/);
    assert.match(appHtml, /data-i18n="season\.reset_target_note"/);
  });
});

test("built UI bundle contains bilingual i18n messages and locale persistence hooks", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const jsResp = await fetch(`${baseUrl}/assets/app/app.js`);
    assert.equal(jsResp.status, 200);
    const js = await jsResp.text();

    assert.match(js, /nas_linker_locale/);
    assert.match(js, /locale\.switcher_aria/);
    assert.match(js, /Sign in to continue/);
    assert.match(js, /Войти, чтобы продолжить/);
    assert.match(js, /Quick NAS linking console/);
    assert.match(js, /Быстрая консоль линковки NAS/);
  });
});

test("built UI bundle avoids runtime autoloader paths that helper does not serve", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const jsResp = await fetch(`${baseUrl}/assets/app/app.js`);
    assert.equal(jsResp.status, 200);
    const js = await jsResp.text();

    // These paths caused real browser failures when the bundle still relied on
    // Shoelace autoloader/runtime component fetches that helper does not serve.
    assert.doesNotMatch(js, /shoelace-autoloader(\.min)?\.js/);
    assert.doesNotMatch(js, /\/components\/[a-z0-9-]+\/[a-z0-9-]+\.js/);
  });
});

test("helper serves the full local UI bootstrap graph used by the page", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const htmlResp = await fetch(`${baseUrl}/`);
    assert.equal(htmlResp.status, 200);
    const html = await htmlResp.text();

    const jsResp = await fetch(`${baseUrl}/assets/app/app.js`);
    assert.equal(jsResp.status, 200);
    const js = await jsResp.text();

    const usedShoelace = collectUsedShoelaceTags(html);
    const definedShoelace = collectDefinedShoelaceTags(js);
    assert.deepEqual(
      usedShoelace.filter((tag) => !definedShoelace.includes(tag)),
      [],
      "built bundle must define every Shoelace component the page uses",
    );

    const [uiTemplateSource, uiRuntimeSource] = await Promise.all([
      readFile(new URL("../src/templates/app-shell.html", import.meta.url), "utf8"),
      readFile(new URL("../src/ui/app-shell-runtime.js", import.meta.url), "utf8"),
    ]);
    const iconNames = collectUiIconNames(`${uiTemplateSource}\n${uiRuntimeSource}`);
    assert.ok(iconNames.length > 0);

    for (const iconName of iconNames) {
      const iconResp = await fetch(`${baseUrl}/assets/vendor/bootstrap-icons/icons/${iconName}.svg`);
      assert.equal(iconResp.status, 200, `missing icon asset for ${iconName}`);
      const iconSvg = await iconResp.text();
      assert.match(iconSvg, /<svg[\s>]/);
    }
  });
});

test("list endpoint returns frozen success shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() {
        return {
          ok: true,
          code: 0,
          items: [{
            uid: "100:200",
            path: `${TORRENTS_ROOT}/Show`,
            type: "d",
            name: "Show",
            size: "-",
            mtime: "2026-03-27 10:00:00.000000000 +0300",
          }],
        };
      },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: TORRENTS_ROOT }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: true,
      dir: TORRENTS_ROOT,
      items: [{
        uid: "100:200",
        path: `${TORRENTS_ROOT}/Show`,
        type: "d",
        name: "Show",
        size: "-",
        mtime: "2026-03-27 10:00:00.000000000 +0300",
      }],
    });
  });
});

test("list endpoint rejects missing dir with frozen error shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({}),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "dir required",
    });
  });
});

test("list endpoint returns frozen executor-error shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() {
        return {
          ok: false,
          code: 2,
          stderr: "ERR: Path contains .. segment\n",
        };
      },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: `${TORRENTS_ROOT}/../escape` }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      stderr: "ERR: Path contains .. segment\n",
    });
  });
});

test("list endpoint rejects disallowed root with frozen error shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: "/etc" }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), { ok: false, error: "dir not allowed" });
  });
});

test("list endpoint rejects sibling path that only shares allowed-root prefix", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: "/volume1/Movies/Torrents-notreally" }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "dir not allowed",
    });
  });
});

test("list endpoint returns executor-error shape for nested traversal under allowed root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor(),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: `${TORRENTS_ROOT}/Show Folder/../escape` }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      stderr: "ERR: Path contains .. segment\n",
    });
  });
});

test("list endpoint accepts printable Unicode path under allowed root", async () => {
  let observedDir = null;
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir({ dir }) {
        observedDir = dir;
        return {
          ok: true,
          code: 0,
          items: [{ type: "d", name: "Сезон 01", size: "-", mtime: "2026-03-30 00:00:00.000000000 +0000" }],
        };
      },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const dir = `${TORRENTS_ROOT}/Фильм`;
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir }),
    });
    assert.equal(resp.status, 200);
    assert.equal(observedDir, dir);
    assert.deepEqual(await resp.json(), {
      ok: true,
      dir,
      items: [{ type: "d", name: "Сезон 01", size: "-", mtime: "2026-03-30 00:00:00.000000000 +0000" }],
    });
  });
});

test("list endpoint returns executor-error shape for control characters under allowed root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor(),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: `${TORRENTS_ROOT}/bad\nname` }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      stderr: "ERR: Control characters in path\n",
    });
  });
});

test("movie endpoint returns frozen success shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() {
        return { code: 0, stdout: "linked\n", stderr: "" };
      },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        src: `${TORRENTS_ROOT}/Movie/file.mkv`,
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: true,
      code: 0,
      stdout: "linked\n",
      stderr: "",
    });
  });
});

test("movie endpoint rejects source outside torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() {
        throw new Error("executor should not be called");
      },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        src: "/etc/movie.mkv",
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "src must be under torrents",
    });
  });
});

test("movie endpoint rejects traversal payload with nested .. segment", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() {
        throw new Error("executor should not be called");
      },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        src: `${TORRENTS_ROOT}/Show/../escape/file.mkv`,
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "src must be under torrents",
    });
  });
});

test("movie endpoint accepts printable Unicode path under torrents root", async () => {
  let observedInput = null;
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie(input) {
        observedInput = input;
        return { code: 0, stdout: "linked-unicode\n", stderr: "" };
      },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const src = `${TORRENTS_ROOT}/Фильм/file.mkv`;
    const resp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        src,
        title: "Фильм",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(observedInput, {
      src,
      title: "Фильм",
      year: "2024",
    });
    assert.deepEqual(await resp.json(), {
      ok: true,
      code: 0,
      stdout: "linked-unicode\n",
      stderr: "",
    });
  });
});

test("movie endpoint returns executor-error shape for control characters under torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor(),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        src: `${TORRENTS_ROOT}/bad\nmovie/file.mkv`,
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      code: 2,
      stdout: "",
      stderr: "ERR: Control characters in path\n",
    });
  });
});

test("season endpoint returns frozen success shape", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() {
        return { code: 0, stdout: "season-linked\n", stderr: "" };
      },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir: `${TORRENTS_ROOT}/Show`,
        title: "Show",
        season: "1",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: true,
      code: 0,
      stdout: "season-linked\n",
      stderr: "",
    });
  });
});

test("season endpoint rejects source directory outside torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() {
        throw new Error("executor should not be called");
      },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir: "/etc/show",
        title: "Show",
        season: "1",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "srcDir must be under torrents",
    });
  });
});

test("season endpoint rejects traversal payload with nested .. segment", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() {
        throw new Error("executor should not be called");
      },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir: `${TORRENTS_ROOT}/Show/../escape`,
        title: "Show",
        season: "1",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 400);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "srcDir must be under torrents",
    });
  });
});

test("season endpoint accepts printable Unicode path under torrents root", async () => {
  let observedInput = null;
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason(input) {
        observedInput = input;
        return { code: 0, stdout: "season-unicode\n", stderr: "" };
      },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const srcDir = `${TORRENTS_ROOT}/Сериал`;
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir,
        title: "Сериал",
        season: "1",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(observedInput, {
      srcDir,
      title: "Сериал",
      season: "1",
      year: "2024",
    });
    assert.deepEqual(await resp.json(), {
      ok: true,
      code: 0,
      stdout: "season-unicode\n",
      stderr: "",
    });
  });
});

test("season endpoint returns executor-error shape for control characters under torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor(),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir: `${TORRENTS_ROOT}/bad\nshow`,
        title: "Show",
        season: "1",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      code: 2,
      stdout: "",
      stderr: "ERR: Control characters in path\n",
    });
  });
});

test("season endpoint forwards resetTarget flag to executor", async () => {
  let observedInput = null;
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason(input) {
        observedInput = input;
        return { code: 0, stdout: "season-reset\n", stderr: "" };
      },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/link/season`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        srcDir: `${TORRENTS_ROOT}/Show`,
        title: "Show",
        season: "1",
        year: "2024",
        resetTarget: true,
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(observedInput, {
      srcDir: `${TORRENTS_ROOT}/Show`,
      title: "Show",
      season: "1",
      year: "2024",
      resetTarget: true,
    });
    assert.deepEqual(await resp.json(), {
      ok: true,
      code: 0,
      stdout: "season-reset\n",
      stderr: "",
    });
  });
});

test("meta search returns 503 frozen error shape when discover is not configured", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    hasPlexDiscoverConfigFn: () => false,
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/meta/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        kind: "show",
        title: "Frieren",
        year: "2023",
      }),
    });
    assert.equal(resp.status, 503);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "Plex Discover not configured",
    });
  });
});

test("meta search returns frozen success shape and strips imdbId", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    hasPlexDiscoverConfigFn: () => true,
    plexDiscoverContainerFn: async () => ({
      ok: true,
      status: 200,
      data: {
        MediaContainer: {
          Metadata: [
            {
              title: "Frieren: Beyond Journey's End",
              year: 2023,
              type: "show",
              summary: "Elf mage travels on.",
              guid: "imdb://tt22248376",
              thumb: "https://image.tmdb.org/t/p/original/poster-a.jpg",
              art: "https://image.tmdb.org/t/p/original/art-a.jpg",
            },
            {
              title: "Frieren: Beyond Journey's End",
              year: 2022,
              type: "show",
              summary: "Wrong year",
              guid: "imdb://tt00000001",
              thumb: "https://image.tmdb.org/t/p/original/poster-b.jpg",
              art: "https://image.tmdb.org/t/p/original/art-b.jpg",
            },
            {
              title: "Filtered Movie",
              year: 2023,
              type: "movie",
              summary: "Wrong kind",
              guid: "imdb://tt00000002",
              thumb: "https://image.tmdb.org/t/p/original/poster-c.jpg",
              art: "https://image.tmdb.org/t/p/original/art-c.jpg",
            },
          ],
        },
      },
    }),
    enrichItemsWithOmdbPosterFn: async (items) =>
      items.map((item) => ({ ...item, thumbUrl: "https://m.media-amazon.com/images/example.jpg" })),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/meta/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        kind: "show",
        title: "Frieren",
        year: "2023",
        limit: 8,
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: true,
      items: [
        {
          title: "Frieren: Beyond Journey's End",
          year: 2023,
          type: "show",
          score: null,
          summary: "Elf mage travels on.",
          guid: "imdb://tt22248376",
          ratingKey: null,
          thumbUrl: "https://m.media-amazon.com/images/example.jpg",
          thumbPath: null,
          artUrl: "https://image.tmdb.org/t/p/original/art-a.jpg",
          artPath: null,
        },
      ],
    });
  });
});

test("meta search strips imdbId across mixed Plex payload shapes", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    hasPlexDiscoverConfigFn: () => true,
    plexDiscoverContainerFn: async () => ({
      ok: true,
      status: 200,
      data: {
        MediaContainer: {
          Metadata: [
            {
              title: "Show A",
              year: 2023,
              type: "show",
              summary: "From Metadata",
              guid: "imdb://tt10000001",
              thumb: "https://image.tmdb.org/t/p/original/show-a.jpg",
            },
          ],
          Hub: [
            {
              Metadata: [
                {
                  title: "Show B",
                  year: 2022,
                  type: "show",
                  summary: "From Hub",
                  Guid: [{ id: "imdb://tt10000002" }],
                  thumb: "https://image.tmdb.org/t/p/original/show-b.jpg",
                },
                {
                  title: "Filtered Movie",
                  year: 2021,
                  type: "movie",
                  summary: "Wrong kind",
                  guid: "imdb://tt19999999",
                },
              ],
            },
          ],
          SearchResults: [
            {
              Metadata: [
                {
                  title: "Show C",
                  year: 2021,
                  type: "show",
                  summary: "From SearchResults.Metadata",
                  guids: {
                    imdb: "imdb://tt10000003",
                  },
                  thumb: "https://image.tmdb.org/t/p/original/show-c.jpg",
                },
              ],
              Results: [
                {
                  title: "Show D",
                  year: 2020,
                  type: "show",
                  summary: "From SearchResults.Results",
                  Guid: ["imdb://tt10000004"],
                  thumb: "https://image.tmdb.org/t/p/original/show-d.jpg",
                },
              ],
              SearchResult: [
                {
                  Directory: {
                    title: "Show E",
                    year: 2019,
                    type: "show",
                    summary: "From SearchResult.Directory",
                    guids: [{ source: "imdb://tt10000005" }],
                    thumb: "https://image.tmdb.org/t/p/original/show-e.jpg",
                  },
                },
              ],
            },
          ],
        },
      },
    }),
    enrichItemsWithOmdbPosterFn: async (items) => items,
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/meta/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        kind: "show",
        title: "Show",
        limit: 10,
      }),
    });
    assert.equal(resp.status, 200);

    const responseText = await resp.text();
    assert.doesNotMatch(responseText, /"imdbId"/);

    const payload = JSON.parse(responseText);
    assert.equal(payload.ok, true);
    assert.deepEqual(
      payload.items.map((item) => item.title),
      ["Show A", "Show B", "Show C", "Show D", "Show E"],
    );
    for (const item of payload.items) {
      assert.equal(item.type, "show");
      assert.equal(Object.hasOwn(item, "imdbId"), false);
    }
  });
});

test("meta search returns frozen upstream-error shape when discover request fails", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    hasPlexDiscoverConfigFn: () => true,
    plexDiscoverContainerFn: async () => ({
      ok: false,
      status: 502,
      data: {
        error: "upstream failed",
        code: "plex_bad_gateway",
      },
    }),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/meta/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({
        kind: "show",
        title: "Frieren",
      }),
    });
    assert.equal(resp.status, 502);
    assert.deepEqual(await resp.json(), {
      ok: false,
      error: "Plex Discover error",
      details: {
        error: "upstream failed",
        code: "plex_bad_gateway",
      },
    });
  });
});

test("saved template routes return frozen list/upsert/delete shapes", async () => {
  const store = makeSavedTemplatesStore([
    {
      id: "saved-1",
      kind: "movie",
      title: "Matrix",
      year: 1999,
      season: null,
      sourceId: "uid-matrix",
      srcPath: `${TORRENTS_ROOT}/Matrix`,
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:00.000Z",
    },
  ]);
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: store,
  });

  await withServer(app, async (baseUrl) => {
    const headers = authHeaders({ runToken: "test-token" });

    const listResp = await fetch(`${baseUrl}/api/saved-templates`, { headers });
    assert.equal(listResp.status, 200);
    assert.deepEqual(await listResp.json(), {
      ok: true,
      items: store.list(),
    });

    const upsertResp = await fetch(`${baseUrl}/api/saved-templates`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        kind: "movie",
        title: "Alien",
        year: "1979",
        sourceId: "uid-alien",
        srcPath: `${TORRENTS_ROOT}/Alien`,
      }),
    });
    assert.equal(upsertResp.status, 200);
    assert.deepEqual(await upsertResp.json(), {
      ok: true,
      item: store.list()[0],
    });

    const deleteResp = await fetch(`${baseUrl}/api/saved-templates/delete`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ id: "saved-1" }),
    });
    assert.equal(deleteResp.status, 200);
    assert.deepEqual(await deleteResp.json(), { ok: true });
  });
});

test("saved template routes ignore unexpected extra fields", async () => {
  const store = {
    item: null,
    list() {
      return this.item ? [this.item] : [];
    },
    upsert(input) {
      this.item = {
        id: "saved-1",
        kind: input.kind,
        title: input.title,
        year: Number(input.year),
        season: input.season == null ? null : Number(input.season),
        sourceId: input.sourceId ?? null,
        srcPath: input.srcPath ?? null,
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
      };
      return this.item;
    },
    delete() {
      return { ok: true };
    },
  };
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: store,
  });

  await withServer(app, async (baseUrl) => {
    const headers = authHeaders({ runToken: "test-token" });
    const upsertResp = await fetch(`${baseUrl}/api/saved-templates`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        kind: "movie",
        title: "Alien",
        year: "1979",
        sourceId: "uid-alien",
        srcPath: `${TORRENTS_ROOT}/Alien`,
        runToken: "runtime-secret",
        plexDiscoverToken: "plex-secret",
        password: "plain-secret",
        notes: "should not persist",
      }),
    });
    const upsertText = await upsertResp.text();
    assert.equal(upsertResp.status, 200, upsertText);

    const upsertData = JSON.parse(upsertText);
    assert.equal(upsertData.ok, true);
    assert.deepEqual(Object.keys(upsertData.item).sort(), [
      "createdAt",
      "id",
      "kind",
      "season",
      "sourceId",
      "srcPath",
      "title",
      "updatedAt",
      "year",
    ]);
    assert.equal("runToken" in upsertData.item, false);
    assert.equal("plexDiscoverToken" in upsertData.item, false);
    assert.equal("password" in upsertData.item, false);
    assert.equal("notes" in upsertData.item, false);

    const listResp = await fetch(`${baseUrl}/api/saved-templates`, { headers });
    assert.equal(listResp.status, 200);
    const listData = await listResp.json();
    assert.equal(listData.ok, true);
    assert.equal(listData.items.length, 1);
    assert.deepEqual(Object.keys(listData.items[0]).sort(), [
      "createdAt",
      "id",
      "kind",
      "season",
      "sourceId",
      "srcPath",
      "title",
      "updatedAt",
      "year",
    ]);
  });
});

test("saved template list fails softly when UX storage is unavailable", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: {
      async linkMovie() { return { code: 0, stdout: "linked\n", stderr: "" }; },
      async linkSeason() { return { code: 0, stdout: "", stderr: "" }; },
      async listDir() { return { ok: true, code: 0, items: [] }; },
    },
    savedTemplatesStore: {
      list() {
        throw new Error("storage unavailable");
      },
      upsert() {
        throw new Error("storage unavailable");
      },
      delete() {
        throw new Error("storage unavailable");
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const headers = authHeaders({ runToken: "test-token" });

    const savedResp = await fetch(`${baseUrl}/api/saved-templates`, { headers });
    assert.equal(savedResp.status, 503);
    assert.deepEqual(await savedResp.json(), {
      ok: false,
      error: "storage unavailable",
    });

    const linkResp = await fetch(`${baseUrl}/api/link/movie`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        src: `${TORRENTS_ROOT}/Movie/file.mkv`,
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(linkResp.status, 200);
    assert.deepEqual(await linkResp.json(), {
      ok: true,
      code: 0,
      stdout: "linked\n",
      stderr: "",
    });
  });
});
