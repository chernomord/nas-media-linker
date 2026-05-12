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

test("torrent source lookup falls back from legacy saved paths to current uid", () => {
  const index = createTorrentSourceIndex(ROOT, [
    { uid: "200:300", name: "Shingeki no Kyojin IV", type: "d" },
  ]);

  const savedItem = {
    srcPath: `${ROOT}/Shingeki_no_Kyojin_IV`,
    sourceId: "",
  };

  assert.equal(resolveTorrentSourceUidFromPath(savedItem.srcPath, index), "200:300");
  assert.equal(resolveSavedTorrentSourceUid(savedItem, index), "200:300");
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
