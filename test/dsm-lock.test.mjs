import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

async function makeHelperCommonFixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-dsm-lock-"));
  const dsmDir = path.join(base, "ops", "dsm");
  await mkdir(dsmDir, { recursive: true });
  await copyFile(
    path.join(process.cwd(), "ops", "dsm", "helper-common.sh"),
    path.join(dsmDir, "helper-common.sh"),
  );
  return {
    base,
    helperCommonPath: path.join(dsmDir, "helper-common.sh"),
    env: {
      NAS_LINKER_ENV_FILE: path.join(dsmDir, "missing.env"),
      NAS_LINKER_PID_FILE: path.join(base, ".run", "nas-linker.pid"),
      NAS_LINKER_LOG_FILE: path.join(base, "helper.log"),
      NAS_LINKER_LOCK_DIR: path.join(base, ".run", "nas-linker.lock"),
    },
  };
}

function runSh(script, { env = {} } = {}) {
  return spawnSync("/bin/sh", ["-c", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

async function writeExecutable(filePath, source) {
  await writeFile(filePath, source, "utf8");
  await chmod(filePath, 0o755);
}

test("nested lock reuse keeps the parent deploy lock until the top-level owner exits", async () => {
  const fixture = await makeHelperCommonFixture();
  const helperCommonArg = JSON.stringify(fixture.helperCommonPath);

  try {
    const result = runSh(`
      set -eu
      . ${helperCommonArg}
      acquire_ops_lock "deploy-helper.sh"

      /bin/sh -c '
        set -eu
        . "$1"
        acquire_ops_lock "restart-helper.sh"

        /bin/sh -c '"'"'
          set -eu
          . "$1"
          acquire_ops_lock "stop-helper.sh"
          release_ops_lock
          [ -d "$LOCK_DIR" ] || {
            echo "grandchild released parent lock" >&2
            exit 1
          }
        '"'"' nested "$1"

        release_ops_lock
        [ -d "$LOCK_DIR" ] || {
          echo "child released parent lock" >&2
          exit 1
        }
      ' nested ${helperCommonArg}

      [ -d "$LOCK_DIR" ] || {
        echo "parent lock missing before final release" >&2
        exit 1
      }

      release_ops_lock
      [ ! -d "$LOCK_DIR" ] || {
        echo "parent failed to release lock" >&2
        exit 1
      }
    `, {
      env: fixture.env,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("helper-common prepends resolved node directory to PATH for npm shebangs", async () => {
  const fixture = await makeHelperCommonFixture();
  const helperCommonArg = JSON.stringify(fixture.helperCommonPath);
  const binDir = path.join(fixture.base, "bin");

  try {
    await mkdir(binDir, { recursive: true });

    await writeExecutable(
      path.join(binDir, "node"),
      `#!/bin/sh
exit 0
`,
    );

    await writeExecutable(
      path.join(binDir, "npm"),
      `#!/bin/sh
exit 0
`,
    );

    const result = runSh(`
      set -eu
      . ${helperCommonArg}
      printf '%s\n' "$PATH"
      printf '%s\n' "$NODE_BIN"
      printf '%s\n' "$NPM_BIN"
    `, {
      env: {
        ...fixture.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const [pathLine, nodeBinLine, npmBinLine] = result.stdout.trim().split("\n");
    assert.equal(pathLine.split(":")[0], binDir);
    assert.equal(nodeBinLine, path.join(binDir, "node"));
    assert.equal(npmBinLine, path.join(binDir, "npm"));
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("manual concurrent operation still fails while another top-level op holds the lock", async () => {
  const fixture = await makeHelperCommonFixture();
  const helperCommonArg = JSON.stringify(fixture.helperCommonPath);

  try {
    const result = runSh(`
      set -eu
      . ${helperCommonArg}
      acquire_ops_lock "deploy-helper.sh"

      if NAS_LINKER_LOCK_HELD=0 NAS_LINKER_LOCK_OWNER_PID= /bin/sh -c '
        set -eu
        . "$1"
        acquire_ops_lock "restart-helper.sh"
      ' nested ${helperCommonArg}; then
        echo "concurrent restart unexpectedly acquired lock" >&2
        exit 1
      fi

      release_ops_lock
    `, {
      env: fixture.env,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stderr, /another nas-linker operation is already running: deploy-helper\.sh/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("deploy helper restarts under the same top-level lock without self-conflict", async () => {
  const fixture = await makeHelperCommonFixture();
  const binDir = path.join(fixture.base, "bin");
  const npmLog = path.join(fixture.base, "npm.log");
  const nodeLog = path.join(fixture.base, "node.log");
  const serverPath = path.join(fixture.base, "server.mjs");
  const deployPath = path.join(fixture.base, "ops", "dsm", "deploy-helper.sh");

  try {
    await mkdir(binDir, { recursive: true });
    await writeFile(serverPath, "export {};\n", "utf8");
    await copyFile(
      path.join(process.cwd(), "ops", "dsm", "deploy-helper.sh"),
      deployPath,
    );
    await chmod(deployPath, 0o755);

    await writeExecutable(
      path.join(binDir, "npm"),
      `#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$NAS_LINKER_TEST_NPM_LOG"
case "$1" in
  ci)
    exit 0
    ;;
  run)
    [ "\${2:-}" = "build:ui" ] || exit 9
    exit 0
    ;;
esac
exit 8
`,
    );

    await writeExecutable(
      path.join(binDir, "node"),
      `#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$NAS_LINKER_TEST_NODE_LOG"
trap 'exit 0' INT TERM
while :; do
  sleep 1
done
`,
    );

    const result = spawnSync(deployPath, {
      cwd: fixture.base,
      encoding: "utf8",
      env: {
        ...process.env,
        ...fixture.env,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        NAS_LINKER_TEST_NPM_LOG: npmLog,
        NAS_LINKER_TEST_NODE_LOG: nodeLog,
      },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /nas-linker deploy: npm ci/);
    assert.match(result.stdout, /nas-linker deploy: build UI/);
    assert.match(result.stdout, /nas-linker deploy: restart helper/);
    assert.doesNotMatch(result.stderr, /another nas-linker operation is already running/);

    const npmCalls = await readFile(npmLog, "utf8");
    assert.match(npmCalls, /^ci$/m);
    assert.match(npmCalls, /^run build:ui$/m);

    const nodeCalls = await readFile(nodeLog, "utf8");
    assert.match(nodeCalls, /--experimental-sqlite server\.mjs/);

    if (process.platform !== "win32") {
      const pidFile = fixture.env.NAS_LINKER_PID_FILE;
      const pid = Number((await readFile(pidFile, "utf8")).trim());
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
    }
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});
