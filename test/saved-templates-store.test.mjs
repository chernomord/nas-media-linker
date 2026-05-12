import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import { createSavedTemplatesStore } from "../src/core/saved-templates-store.mjs";

async function makeStore() {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-db-"));
  return {
    base,
    store: createSavedTemplatesStore({
      dbPath: path.join(base, "ux-state.sqlite"),
    }),
  };
}

test("saved template upsert uses natural key and updates srcPath", async () => {
  const fixture = await makeStore();
  try {
    const first = fixture.store.upsert({
      kind: "season",
      title: "Frieren",
      year: "2023",
      season: "1",
      sourceId: "uid-1",
      srcPath: "/volume1/Movies/Torrents/Frieren",
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = fixture.store.upsert({
      kind: "season",
      title: "Frieren",
      year: "2023",
      season: "1",
      sourceId: "uid-2",
      srcPath: "/volume1/Movies/Torrents/Frieren-v2",
    });

    const items = fixture.store.list();
    assert.equal(items.length, 1);
    assert.equal(second.id, first.id);
    assert.equal(second.createdAt, first.createdAt);
    assert.equal(second.sourceId, "uid-2");
    assert.equal(second.srcPath, "/volume1/Movies/Torrents/Frieren-v2");
    assert.notEqual(second.updatedAt, first.updatedAt);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("saved template store keeps distinct identities for movie and season", async () => {
  const fixture = await makeStore();
  try {
    fixture.store.upsert({
      kind: "movie",
      title: "Dune",
      year: "2024",
      sourceId: "uid-movie",
      srcPath: "/volume1/Movies/Torrents/Dune",
    });
    fixture.store.upsert({
      kind: "season",
      title: "Dune",
      year: "2024",
      season: "1",
      sourceId: "uid-season",
      srcPath: "/volume1/Movies/Torrents/Dune-Series",
    });

    const items = fixture.store.list();
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((item) => item.kind).sort(),
      ["movie", "season"],
    );
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("saved template delete removes the record", async () => {
  const fixture = await makeStore();
  try {
    const item = fixture.store.upsert({
      kind: "movie",
      title: "Matrix",
      year: "1999",
      sourceId: "uid-matrix",
      srcPath: "/volume1/Movies/Torrents/Matrix",
    });

    fixture.store.delete(item.id);
    assert.deepEqual(fixture.store.list(), []);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("saved template store ignores extra secret-like fields", async () => {
  const fixture = await makeStore();
  try {
    const item = fixture.store.upsert({
      kind: "movie",
      title: "Matrix",
      year: "1999",
      sourceId: "uid-matrix",
      srcPath: "/volume1/Movies/Torrents/Matrix",
      runToken: "runtime-secret",
      plexDiscoverToken: "plex-secret",
      password: "plain-secret",
      notes: "should not persist",
    });

    assert.deepEqual(Object.keys(item).sort(), [
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

    assert.deepEqual(fixture.store.list(), [item]);
    assert.equal("runToken" in item, false);
    assert.equal("plexDiscoverToken" in item, false);
    assert.equal("password" in item, false);
    assert.equal("notes" in item, false);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});
