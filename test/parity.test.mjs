import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";

import { createExecutor } from "../lib/executor.mjs";

const SCRIPT_PATH = path.resolve("linkmedia.sh");

async function makeFixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "nas-linker-parity-"));
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
    executor: createExecutor({
      mode: "node",
      scriptPath: "/tmp/ignored",
      roots,
    }),
  };
}

function runBash(args, roots) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", [SCRIPT_PATH, ...args], {
      env: {
        ...process.env,
        TORRENTS_ROOT: roots.torrents,
        MOVIES_ROOT: roots.movies,
        TV_ROOT: roots.tv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

test("bash and node linkMovie produce the same observable result", async () => {
  const fixture = await makeFixture();
  try {
    const src = path.join(fixture.roots.torrents, "movie.mkv");
    await writeFile(src, "video");

    const bash = await runBash(["linkmovie", src, "Movie/Name", "2024"], fixture.roots);
    const node = await fixture.executor.linkMovie({
      src,
      title: "Movie/Name",
      year: "2024",
    });

    assert.equal(node.code, bash.code);
    assert.equal(node.stderr, bash.stderr);
    assert.equal(node.stdout, bash.stdout);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("bash and node linkSeason produce the same observable result", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Show");
    await mkdir(srcDir);
    await writeFile(path.join(srcDir, "S01E01.mkv"), "one");
    await writeFile(path.join(srcDir, "S01E02.mp4"), "two");

    const bash = await runBash(["linkseason", srcDir, "Show/Name", "1", "2025"], fixture.roots);
    const node = await fixture.executor.linkSeason({
      srcDir,
      title: "Show/Name",
      season: "1",
      year: "2025",
    });

    assert.equal(node.code, bash.code);
    assert.equal(node.stderr, bash.stderr);
    assert.equal(node.stdout, bash.stdout);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("bash and node listDir produce the same parsed items", async () => {
  const fixture = await makeFixture();
  try {
    await mkdir(path.join(fixture.roots.torrents, "Alpha"));
    await writeFile(path.join(fixture.roots.torrents, "beta.mkv"), "video");

    const bash = await runBash(["listdir", fixture.roots.torrents], fixture.roots);
    const node = await fixture.executor.listDir({ dir: fixture.roots.torrents });

    assert.equal(bash.code, 0);
    assert.equal(node.ok, true);

    const bashItems = bash.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [type, name, size, mtime] = line.split("|");
        return { type, name, size, mtime };
      });

    assert.deepEqual(
      node.items.map(({ type, name, size }) => ({ type, name, size })),
      bashItems.map(({ type, name, size }) => ({ type, name, size })),
    );
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("bash and node linkMovie preserve spaces in source and destination paths", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Movie Folder");
    await mkdir(srcDir);
    const src = path.join(srcDir, "Feature Film.mkv");
    await writeFile(src, "video");

    const bash = await runBash(["linkmovie", srcDir, "Movie Name", "2024"], fixture.roots);
    const node = await fixture.executor.linkMovie({
      src: srcDir,
      title: "Movie Name",
      year: "2024",
    });

    assert.equal(node.code, bash.code);
    assert.equal(node.stderr, bash.stderr);
    assert.equal(node.stdout, bash.stdout);
    assert.match(node.stdout, /Movie Folder\/Feature Film\.mkv/);
    assert.match(node.stdout, /Movie Name \(2024\)\/Movie Name \(2024\)\.mkv/);
    assert.doesNotMatch(node.stdout, /Movie_Name|Feature_Film/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("bash and node linkSeason preserve spaces in source and destination paths", async () => {
  const fixture = await makeFixture();
  try {
    const srcDir = path.join(fixture.roots.torrents, "Show Folder");
    await mkdir(srcDir);
    await writeFile(path.join(srcDir, "Episode 01.mkv"), "one");
    await writeFile(path.join(srcDir, "Episode 02.mp4"), "two");

    const bash = await runBash(["linkseason", srcDir, "Show Name", "1", "2025"], fixture.roots);
    const node = await fixture.executor.linkSeason({
      srcDir,
      title: "Show Name",
      season: "1",
      year: "2025",
    });

    assert.equal(node.code, bash.code);
    assert.equal(node.stderr, bash.stderr);
    assert.equal(node.stdout, bash.stdout);
    assert.match(node.stdout, /Show Folder/);
    assert.match(node.stdout, /Show Name \(2025\)\/Season 01\/Episode 01\.mkv/);
    assert.doesNotMatch(node.stdout, /Show_Name|Episode_01/);
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});

test("bash and node listDir preserve spaces in entry names", async () => {
  const fixture = await makeFixture();
  try {
    await mkdir(path.join(fixture.roots.torrents, "Alpha One"));
    await writeFile(path.join(fixture.roots.torrents, "beta one.mkv"), "video");

    const bash = await runBash(["listdir", fixture.roots.torrents], fixture.roots);
    const node = await fixture.executor.listDir({ dir: fixture.roots.torrents });

    assert.equal(bash.code, 0);
    assert.equal(node.ok, true);
    assert.match(bash.stdout, /Alpha One/);
    assert.match(bash.stdout, /beta one\.mkv/);
    assert.doesNotMatch(bash.stdout, /Alpha_One|beta_one\.mkv/);
    assert.deepEqual(
      node.items.map(({ type, name, size }) => ({ type, name, size })),
      bash.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [type, name, size] = line.split("|");
          return { type, name, size };
        }),
    );
  } finally {
    await rm(fixture.base, { recursive: true, force: true });
  }
});
