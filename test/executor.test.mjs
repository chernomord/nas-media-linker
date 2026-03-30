import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";

import { createExecutor } from "../src/core/executor.mjs";

async function makeFixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-"));
  const roots = {
    torrents: path.join(base, "Torrents"),
    movies: path.join(base, "Movies"),
    tv: path.join(base, "TV Shows"),
  };

  await mkdir(roots.torrents, { recursive: true });
  await mkdir(roots.movies, { recursive: true });
  await mkdir(roots.tv, { recursive: true });

  return {
    base,
    roots,
    executor: createExecutor({ roots }),
  };
}

test("executor initializes with default config", () => {
  assert.doesNotThrow(() => createExecutor());
});

test("listDir returns sorted items with stable shape", async () => {
  const fixture = await makeFixture();
  try {
    await mkdir(path.join(fixture.roots.torrents, "Alpha"));
    await writeFile(path.join(fixture.roots.torrents, "beta.mkv"), "video");

    const result = await fixture.executor.listDir({ dir: fixture.roots.torrents });
    assert.equal(result.ok, true);
    assert.equal(result.code, 0);
    assert.deepEqual(
      result.items.map((item) => item.name),
      ["Alpha", "beta.mkv"],
    );
    assert.deepEqual(
      result.items.map((item) => item.type),
      ["d", "f"],
    );
    assert.equal(result.items[0].size, "-");
    assert.match(result.items[0].mtime, /^\d{4}-\d{2}-\d{2} /);
    assert.equal(result.items[1].size, "5");
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("listDir rejects traversal segments", async () => {
  const fixture = await makeFixture();
  try {
    const result = await fixture.executor.listDir({
      dir: `${fixture.roots.torrents}/../escape`,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Path contains \.\. segment/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("listDir allows printable Unicode path segments", async () => {
  const fixture = await makeFixture();
  try {
    const dir = path.join(fixture.roots.torrents, "Фильм");
    await mkdir(dir);
    await writeFile(path.join(dir, "Серия 01.mkv"), "video");

    const result = await fixture.executor.listDir({ dir });
    assert.equal(result.ok, true);
    assert.equal(result.code, 0);
    assert.deepEqual(result.items.map((item) => item.name), ["Серия 01.mkv"]);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("listDir rejects control characters in path segments", async () => {
  const fixture = await makeFixture();
  try {
    const result = await fixture.executor.listDir({
      dir: `${fixture.roots.torrents}/bad\nname`,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Control characters in path/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkMovie creates a hardlink with sanitized destination name", async () => {
  const fixture = await makeFixture();
  try {
    const src = path.join(fixture.roots.torrents, "movie.mkv");
    await writeFile(src, "video");

    const result = await fixture.executor.linkMovie({
      src,
      title: "My/Movie",
      year: "2024",
    });

    const dst = path.join(fixture.roots.movies, "My-Movie (2024)", "My-Movie (2024).mkv");
    const srcStat = await stat(src);
    const dstStat = await stat(dst);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Linked movie:/);
    assert.match(result.stdout, /My-Movie \(2024\)\.mkv/);
    assert.equal(srcStat.ino, dstStat.ino);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkMovie rejects directories with multiple video files", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Batch");
    await mkdir(srcDir);
    await writeFile(path.join(srcDir, "a.mkv"), "one");
    await writeFile(path.join(srcDir, "b.mp4"), "two");

    const result = await fixture.executor.linkMovie({
      src: srcDir,
      title: "Batch",
      year: "2024",
    });

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Multiple video files in directory/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkMovie allows printable Unicode source paths", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Фильм");
    await mkdir(srcDir);
    const src = path.join(srcDir, "Фильм.mkv");
    await writeFile(src, "video");

    const result = await fixture.executor.linkMovie({
      src: srcDir,
      title: "Фильм",
      year: "2024",
    });

    const dst = path.join(fixture.roots.movies, "Фильм (2024)", "Фильм (2024).mkv");
    const srcStat = await stat(src);
    const dstStat = await stat(dst);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Фильм \(2024\)\.mkv/);
    assert.equal(srcStat.ino, dstStat.ino);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkMovie rejects control characters in source paths", async () => {
  const fixture = await makeFixture();
  try {
    const result = await fixture.executor.linkMovie({
      src: `${fixture.roots.torrents}/bad\nmovie.mkv`,
      title: "Movie",
      year: "2024",
    });

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Control characters in path/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkSeason links all video files preserving basenames", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Show");
    await mkdir(srcDir);
    const ep1 = path.join(srcDir, "S01E01.mkv");
    const ep2 = path.join(srcDir, "S01E02.mp4");
    await writeFile(ep1, "one");
    await writeFile(ep2, "two");

    const result = await fixture.executor.linkSeason({
      srcDir,
      title: "Show/Name",
      season: "1",
      year: "2025",
    });

    const dstDir = path.join(fixture.roots.tv, "Show-Name (2025)", "Season 01");
    const ep1Dst = path.join(dstDir, "S01E01.mkv");
    const ep2Dst = path.join(dstDir, "S01E02.mp4");
    const ep1Stat = await stat(ep1);
    const ep1DstStat = await stat(ep1Dst);
    const ep2Stat = await stat(ep2);
    const ep2DstStat = await stat(ep2Dst);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Linked season:/);
    assert.match(result.stdout, /season: 01/);
    assert.match(result.stdout, /Show-Name \(2025\)/);
    assert.equal(ep1Stat.ino, ep1DstStat.ino);
    assert.equal(ep2Stat.ino, ep2DstStat.ino);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkSeason allows printable Unicode source paths", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Сериал");
    await mkdir(srcDir);
    const ep1 = path.join(srcDir, "Серия 01.mkv");
    const ep2 = path.join(srcDir, "Серия 02.mp4");
    await writeFile(ep1, "one");
    await writeFile(ep2, "two");

    const result = await fixture.executor.linkSeason({
      srcDir,
      title: "Сериал",
      season: "1",
      year: "2025",
    });

    const dstDir = path.join(fixture.roots.tv, "Сериал (2025)", "Season 01");
    const ep1Dst = path.join(dstDir, "Серия 01.mkv");
    const ep2Dst = path.join(dstDir, "Серия 02.mp4");
    const ep1Stat = await stat(ep1);
    const ep1DstStat = await stat(ep1Dst);
    const ep2Stat = await stat(ep2);
    const ep2DstStat = await stat(ep2Dst);

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Сериал \(2025\)/);
    assert.equal(ep1Stat.ino, ep1DstStat.ino);
    assert.equal(ep2Stat.ino, ep2DstStat.ino);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("linkSeason rejects control characters in source paths", async () => {
  const fixture = await makeFixture();
  try {
    const result = await fixture.executor.linkSeason({
      srcDir: `${fixture.roots.torrents}/bad\nshow`,
      title: "Show",
      season: "1",
      year: "2025",
    });

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Control characters in path/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});
