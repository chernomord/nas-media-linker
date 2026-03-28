import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { createExecutor, TORRENTS_ROOT } from "../lib/executor.mjs";
import { createSavedTemplatesStore } from "../lib/saved-templates-store.mjs";
import { createApp } from "../helper.mjs";

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
    assert.doesNotMatch(html, /const RUN_TOKEN = "test-token";/);
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
    assert.match(html, /const RUN_TOKEN = "test-token";/);
    assert.match(html, /id="logout_btn"/);
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
    assert.match(html, /const RUN_TOKEN = "runtime-token-123";/);
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

    assert.match(html, /href="\/assets\/app\/app\.css"/);
    assert.match(html, /src="\/assets\/app\/app\.js"/);
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

    const uiSource = await readFile(new URL("../ui.html", import.meta.url), "utf8");
    const iconNames = collectUiIconNames(uiSource);
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
          items: [{ type: "d", name: "Show", size: "-", mtime: "2026-03-27 10:00:00.000000000 +0300" }],
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
      items: [{ type: "d", name: "Show", size: "-", mtime: "2026-03-27 10:00:00.000000000 +0300" }],
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

test("list endpoint uses bash rollback executor path when configured", async () => {
  let observedCommand = null;
  const executor = createExecutor({
    mode: "bash",
    scriptPath: "/volume1/scripts/linkmedia.sh",
    sshExecOverride: async (command) => {
      observedCommand = command;
      return {
        code: 0,
        stdout: "d|Show Folder|-|2026-03-28 20:00:00.000000000 +0300\n",
        stderr: "",
      };
    },
  });

  const app = createApp({
    runToken: "test-token",
    executor,
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
      items: [{ type: "d", name: "Show Folder", size: "-", mtime: "2026-03-28 20:00:00.000000000 +0300" }],
    });
    assert.equal(
      observedCommand,
      "/bin/bash '/volume1/scripts/linkmedia.sh' listdir '/volume1/Movies/Torrents'",
    );
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
    executor: createExecutor({
      mode: "node",
      scriptPath: "/volume1/scripts/linkmedia.sh",
    }),
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

test("list endpoint returns executor-error shape for non-ASCII path under allowed root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor({
      mode: "node",
      scriptPath: "/volume1/scripts/linkmedia.sh",
    }),
    savedTemplatesStore: makeSavedTemplatesStore(),
  });

  await withServer(app, async (baseUrl) => {
    const resp = await fetch(`${baseUrl}/api/list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders({ runToken: "test-token" }),
      },
      body: JSON.stringify({ dir: `${TORRENTS_ROOT}/Фильм` }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      stderr: "ERR: Non-ASCII or control characters in path\n",
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

test("movie endpoint uses bash rollback executor path when configured", async () => {
  let observedCommand = null;
  const executor = createExecutor({
    mode: "bash",
    scriptPath: "/volume1/scripts/linkmedia.sh",
    sshExecOverride: async (command) => {
      observedCommand = command;
      return {
        code: 0,
        stdout: "linked\n",
        stderr: "",
      };
    },
  });

  const app = createApp({
    runToken: "test-token",
    executor,
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
        src: `${TORRENTS_ROOT}/Movie Folder/file name.mkv`,
        title: "Movie Title",
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
    assert.equal(
      observedCommand,
      "/bin/bash '/volume1/scripts/linkmedia.sh' linkmovie '/volume1/Movies/Torrents/Movie Folder/file name.mkv' 'Movie Title' '2024'",
    );
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

test("movie endpoint returns executor-error shape for non-ASCII path under torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor({
      mode: "node",
      scriptPath: "/volume1/scripts/linkmedia.sh",
    }),
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
        src: `${TORRENTS_ROOT}/Фильм/file.mkv`,
        title: "Movie",
        year: "2024",
      }),
    });
    assert.equal(resp.status, 200);
    assert.deepEqual(await resp.json(), {
      ok: false,
      code: 2,
      stdout: "",
      stderr: "ERR: Non-ASCII or control characters in path\n",
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

test("season endpoint uses bash rollback executor path when configured", async () => {
  let observedCommand = null;
  const executor = createExecutor({
    mode: "bash",
    scriptPath: "/volume1/scripts/linkmedia.sh",
    sshExecOverride: async (command) => {
      observedCommand = command;
      return {
        code: 0,
        stdout: "season-linked\n",
        stderr: "",
      };
    },
  });

  const app = createApp({
    runToken: "test-token",
    executor,
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
        srcDir: `${TORRENTS_ROOT}/Show Folder`,
        title: "Show Title",
        season: "2",
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
    assert.equal(
      observedCommand,
      "/bin/bash '/volume1/scripts/linkmedia.sh' linkseason '/volume1/Movies/Torrents/Show Folder' 'Show Title' '2' '2024'",
    );
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

test("season endpoint returns executor-error shape for non-ASCII path under torrents root", async () => {
  const app = createApp({
    runToken: "test-token",
    executor: createExecutor({
      mode: "node",
      scriptPath: "/volume1/scripts/linkmedia.sh",
    }),
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
        srcDir: `${TORRENTS_ROOT}/Сериал`,
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
      stderr: "ERR: Non-ASCII or control characters in path\n",
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
