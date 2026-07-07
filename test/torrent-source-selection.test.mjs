import test from "node:test";
import assert from "node:assert/strict";

import {
  createTorrentSourceIndex,
  resolveSavedTorrentSourceUid,
  resolveTorrentSourcePathFromUid,
  resolveTorrentSourceUidFromPath,
} from "../src/ui/torrent-source-selection.mjs";

const ROOT = "/volume1/Movies/qbt-downloads";

test("torrent source index uses backend uid and exact path mapping", () => {
  const index = createTorrentSourceIndex(ROOT, [
    { uid: "100:200", name: "The.Boys.S05", type: "d" },
    { uid: "100:201", name: "Taboo.Gohatto.1999.1080p.WEB-DL.mkv", type: "f" },
  ]);

  assert.equal(resolveTorrentSourcePathFromUid("100:200", index), `${ROOT}/The.Boys.S05`);
  assert.equal(resolveTorrentSourcePathFromUid("100:201", index), `${ROOT}/Taboo.Gohatto.1999.1080p.WEB-DL.mkv`);
  assert.equal(resolveTorrentSourceUidFromPath(`${ROOT}/The.Boys.S05`, index), "100:200");
});

test("torrent source index encodes path-like uids to avoid whitespace normalization", () => {
  const index = createTorrentSourceIndex(ROOT, [
    { name: "Bundle Show", type: "d" },
  ]);

  const uid = resolveTorrentSourceUidFromPath(`${ROOT}/Bundle Show`, index);
  assert.equal(uid, `path:${encodeURIComponent(`${ROOT}/Bundle Show`)}`);
  assert.equal(resolveTorrentSourcePathFromUid(uid, index), `${ROOT}/Bundle Show`);
});

test("torrent source lookup falls back from legacy saved paths to current uid", () => {
  const index = createTorrentSourceIndex(ROOT, [
    { name: "Shingeki no Kyojin IV", type: "d" },
  ]);

  const savedItem = {
    srcPath: `${ROOT}/Shingeki no Kyojin IV`,
    sourceId: "",
  };

  const uid = resolveSavedTorrentSourceUid(savedItem, index);
  assert.equal(uid, `path:${encodeURIComponent(`${ROOT}/Shingeki no Kyojin IV`)}`);
  assert.equal(resolveTorrentSourcePathFromUid(uid, index), `${ROOT}/Shingeki no Kyojin IV`);
});

test("saved sourceId takes precedence over legacy path heuristics", () => {
  const index = createTorrentSourceIndex(ROOT, [
    { uid: "300:400", name: "Nippon Sangoku", type: "d" },
  ]);

  assert.equal(
    resolveSavedTorrentSourceUid({
      sourceId: "legacy-uid",
      srcPath: `${ROOT}/Nippon_Sangoku`,
    }, index),
    "legacy-uid",
  );
});
