import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "ops", "remote", "deploy-helper.sh");

test("remote deploy wrapper uses ssh and tar while preserving DSM env state", async () => {
  const script = await readFile(SCRIPT_PATH, "utf8");

  assert.match(script, /movies_linker@synology\.local/);
  assert.match(script, /nas-linker remote deploy: target=\$SSH_TARGET local=\$LOCAL_APP_DIR remote=\$REMOTE_APP_DIR/);
  assert.match(script, /nas-linker remote deploy: ensure remote app dir/);
  assert.match(script, /nas-linker remote deploy: archive checkout/);
  assert.match(script, /nas-linker remote deploy: sync checkout/);
  assert.match(script, /nas-linker remote deploy: run remote deploy script/);
  assert.match(script, /tar --no-xattrs --no-mac-metadata -C "\$LOCAL_APP_DIR"/);
  assert.match(script, /tar --no-same-owner --no-same-permissions -xf - -C '\$REMOTE_APP_DIR_QUOTED'/);
  assert.match(script, /ssh/);
  assert.match(script, /deploy-helper\.sh/);
  assert.match(script, /ops\/dsm\/nas-linker\.env/);
});

test("top-level deploy-local wrapper delegates to remote deploy helper", async () => {
  const script = await readFile(path.join(REPO_ROOT, "deploy-local.sh"), "utf8");

  assert.match(script, /exec "\$SCRIPT_DIR\/ops\/remote\/deploy-helper\.sh"/);
  assert.match(script, /set -eu/);
});
