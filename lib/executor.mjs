import fs from "node:fs";
import path from "node:path";
import { promises as fsp } from "node:fs";
import { Client } from "ssh2";

export const TORRENTS_ROOT = "/volume1/Movies/Torrents";
export const MOVIES_ROOT = "/volume1/Movies/Movies";
export const TV_ROOT = "/volume1/Movies/TV Shows";
export const ALLOWED_LIST_ROOTS = [TORRENTS_ROOT, MOVIES_ROOT, TV_ROOT];
const DEFAULT_ROOTS = {
  torrents: TORRENTS_ROOT,
  movies: MOVIES_ROOT,
  tv: TV_ROOT,
};

class ExecutorInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ExecutorInputError";
    this.exitCode = 2;
  }
}

function escShell(value) {
  return `'${String(value).replaceAll(`'`, `'\\''`)}'`;
}

function rejectUnsafePath(p) {
  if (typeof p !== "string") {
    throw new ExecutorInputError("Path must be a string");
  }
  if (/(^|\/)\.\.(\/|$)/.test(p)) {
    throw new ExecutorInputError("Path contains .. segment");
  }
  if (/[^\x20-\x7E]/.test(p)) {
    throw new ExecutorInputError("Non-ASCII or control characters in path");
  }
}

function formatExecutorError(error) {
  if (error instanceof ExecutorInputError) {
    return `ERR: ${error.message}\n`;
  }
  const message = error instanceof Error ? error.message : String(error);
  return `${message}\n`;
}

function errorCode(error) {
  return Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}

function sortByPathByteOrder(values) {
  return values.sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  );
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatStatTime(stat) {
  const date = stat.mtime;
  const ns = String(Math.trunc(stat.mtimeMs * 1e6) % 1e9).padStart(9, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad2(Math.floor(absOffset / 60))}${pad2(absOffset % 60)}`;
  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${ns}`,
    offset,
  ].join(" ");
}

export function isUnder(p, root) {
  if (typeof p !== "string") return false;
  if (/(^|\/)\.\.(\/|$)/.test(p)) return false;
  return p === root || p.startsWith(root + "/");
}

export function isAllowedListDir(dir, roots = DEFAULT_ROOTS) {
  if (typeof dir !== "string") return false;
  return [roots.torrents, roots.movies, roots.tv].some((root) => dir === root || dir.startsWith(root + "/"));
}

function parseListdirOutput(stdout) {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [type, name, size, mtime] = line.split("|");
      return { type, name, size, mtime };
    });
}

function sanitizeName(value) {
  return String(value).replaceAll("/", "-").replaceAll("\n", " ");
}

function isVideoFilename(name) {
  return [".mkv", ".mp4", ".avi", ".m4v"].some((ext) => name.endsWith(ext));
}

async function pathKind(value) {
  try {
    const stat = await fsp.stat(value);
    if (stat.isDirectory()) return "dir";
    if (stat.isFile()) return "file";
    return "other";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

async function resolveSingleMovieSource(src) {
  const kind = await pathKind(src);

  if (kind === "dir") {
    const names = await fsp.readdir(src);
    const files = sortByPathByteOrder(
      names
        .filter((name) => isVideoFilename(name))
        .map((name) => path.posix.join(src, name)),
    );

    if (files.length === 0) {
      throw new ExecutorInputError(`No video files in directory: ${src}`);
    }
    if (files.length !== 1) {
      throw new ExecutorInputError(`Multiple video files in directory, pass exact file path: ${src}`);
    }
    return files[0];
  }

  if (kind !== "file") {
    throw new ExecutorInputError(`SRC is not a file: ${src}`);
  }

  return src;
}

async function resolveSeasonSources(srcDir) {
  const kind = await pathKind(srcDir);
  if (kind !== "dir") {
    throw new ExecutorInputError(`SRC is not a directory: ${srcDir}`);
  }

  const names = await fsp.readdir(srcDir);
  const files = sortByPathByteOrder(
    names
      .filter((name) => isVideoFilename(name))
      .map((name) => path.posix.join(srcDir, name)),
  );

  if (files.length === 0) {
    throw new ExecutorInputError(`No video files in ${srcDir}`);
  }

  return files;
}

async function replaceHardlink(src, dst) {
  try {
    await fsp.unlink(dst);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await fsp.link(src, dst);
}

function createSshExec({ host, username, privateKeyPath }) {
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");

  return function sshExec(cmd) {
    return new Promise((resolve) => {
      const conn = new Client();
      let stdout = "";
      let stderr = "";

      conn
        .on("ready", () => {
          conn.exec(cmd, (err, stream) => {
            if (err) {
              conn.end();
              return resolve({ code: 255, stdout: "", stderr: String(err) });
            }
            stream.on("data", (chunk) => {
              stdout += chunk.toString("utf8");
            });
            stream.stderr.on("data", (chunk) => {
              stderr += chunk.toString("utf8");
            });
            stream.on("close", (code) => {
              conn.end();
              resolve({ code: code ?? 0, stdout, stderr });
            });
          });
        })
        .on("error", (error) => resolve({ code: 255, stdout: "", stderr: String(error) }))
        .connect({
          host,
          username,
          privateKey,
        });
    });
  };
}

function createBashExecutor({ scriptPath, sshExec }) {
  return {
    async linkMovie({ src, title, year }) {
      const cmd =
        `/bin/bash ${escShell(scriptPath)} linkmovie ` +
        `${escShell(src)} ${escShell(title)} ${escShell(String(year))}`;
      return sshExec(cmd);
    },

    async linkSeason({ srcDir, title, season, year }) {
      const cmd =
        `/bin/bash ${escShell(scriptPath)} linkseason ` +
        `${escShell(srcDir)} ${escShell(title)} ${escShell(String(season))} ${escShell(String(year))}`;
      return sshExec(cmd);
    },

    async listDir({ dir }) {
      const cmd = `/bin/bash ${escShell(scriptPath)} listdir ${escShell(dir)}`;
      const result = await sshExec(cmd);
      if (result.code !== 0) {
        return { ok: false, code: result.code, stderr: result.stderr };
      }
      return { ok: true, code: result.code, items: parseListdirOutput(result.stdout) };
    },
  };
}

function createNodeExecutor({ roots }) {
  return {
    async linkMovie({ src, title, year }) {
      try {
        rejectUnsafePath(src);
        if (!isUnder(src, roots.torrents)) {
          throw new ExecutorInputError(`SRC not under ${roots.torrents}`);
        }
        if (!/^\d{4}$/.test(String(year))) {
          throw new ExecutorInputError("YEAR must be 4 digits");
        }

        const resolvedSrc = await resolveSingleMovieSource(src);
        const safeTitle = sanitizeName(title);
        const dstDir = path.posix.join(roots.movies, `${safeTitle} (${year})`);
        await fsp.mkdir(dstDir, { recursive: true });

        const ext = path.posix.extname(resolvedSrc);
        const dst = path.posix.join(dstDir, `${safeTitle} (${year})${ext}`);
        await replaceHardlink(resolvedSrc, dst);

        return {
          code: 0,
          stdout: `Linked movie:\n  ${resolvedSrc}\n  -> ${dst}\n`,
          stderr: "",
        };
      } catch (error) {
        return { code: errorCode(error), stdout: "", stderr: formatExecutorError(error) };
      }
    },

    async linkSeason({ srcDir, title, season, year }) {
      try {
        rejectUnsafePath(srcDir);
        if (!isUnder(srcDir, roots.torrents)) {
          throw new ExecutorInputError(`SRC not under ${roots.torrents}`);
        }
        if (!/^\d+$/.test(String(season))) {
          throw new ExecutorInputError("SEASON must be integer");
        }
        if (!/^\d{4}$/.test(String(year))) {
          throw new ExecutorInputError("YEAR must be 4 digits");
        }

        const files = await resolveSeasonSources(srcDir);
        const safeTitle = sanitizeName(title);
        const paddedSeason = pad2(season);
        const showDir = path.posix.join(roots.tv, `${safeTitle} (${year})`);
        const dstDir = path.posix.join(showDir, `Season ${paddedSeason}`);
        await fsp.mkdir(dstDir, { recursive: true });

        const lines = [];
        for (const src of files) {
          const dst = path.posix.join(dstDir, path.posix.basename(src));
          await replaceHardlink(src, dst);
          lines.push(`  ${src}`);
          lines.push(`  -> ${dst}`);
        }

        lines.push("Linked season:");
        lines.push(`  show: ${safeTitle} (${year})`);
        lines.push(`  season: ${paddedSeason}`);
        lines.push(`  from: ${srcDir}`);
        lines.push(`  to: ${dstDir}`);

        return {
          code: 0,
          stdout: `${lines.join("\n")}\n`,
          stderr: "",
        };
      } catch (error) {
        return { code: errorCode(error), stdout: "", stderr: formatExecutorError(error) };
      }
    },

    async listDir({ dir }) {
      try {
        rejectUnsafePath(dir);
        if (!isAllowedListDir(dir, roots)) {
          throw new ExecutorInputError("Directory not allowed");
        }

        const rootStat = await fsp.stat(dir);
        if (!rootStat.isDirectory()) {
          throw new ExecutorInputError("Not a directory");
        }

        const names = await fsp.readdir(dir);
        const paths = sortByPathByteOrder(names.map((name) => path.posix.join(dir, name)));
        const items = [];

        for (const entryPath of paths) {
          let type = "f";
          let size = "-";
          let mtime = "-";

          try {
            const stat = await fsp.stat(entryPath);
            type = stat.isDirectory() ? "d" : "f";
            size = stat.isDirectory() ? "-" : String(stat.size);
            mtime = formatStatTime(stat);
          } catch {
            // Keep listing stable even if stat fails for a single entry.
          }

          items.push({
            type,
            name: path.posix.basename(entryPath),
            size,
            mtime,
          });
        }

        return { ok: true, code: 0, items };
      } catch (error) {
        return { ok: false, code: errorCode(error), stderr: formatExecutorError(error) };
      }
    },
  };
}

export function createExecutor({ mode, scriptPath, ssh, sshExecOverride = null, roots: rootOverrides = {} }) {
  if (!["bash", "node"].includes(mode)) {
    throw new Error(`EXECUTOR_MODE must be bash|node, got: ${mode}`);
  }

  const roots = {
    torrents: DEFAULT_ROOTS.torrents,
    movies: DEFAULT_ROOTS.movies,
    tv: DEFAULT_ROOTS.tv,
    ...rootOverrides,
  };
  const node = createNodeExecutor({ roots });

  let bash = null;
  if (mode === "bash") {
    if (!sshExecOverride && (!ssh?.host || !ssh?.username || !ssh?.privateKeyPath)) {
      throw new Error("Bash executor requires ssh.host, ssh.username and ssh.privateKeyPath");
    }
    const sshExec = sshExecOverride ?? createSshExec(ssh);
    bash = createBashExecutor({ scriptPath, sshExec });
  }

  return {
    mode,

    async linkMovie(input) {
      if (mode === "node") return node.linkMovie(input);
      if (!bash) throw new Error("Bash executor is not initialized");
      return bash.linkMovie(input);
    },

    async linkSeason(input) {
      if (mode === "node") return node.linkSeason(input);
      if (!bash) throw new Error("Bash executor is not initialized");
      return bash.linkSeason(input);
    },

    async listDir(input) {
      if (mode === "node") return node.listDir(input);
      if (!bash) throw new Error("Bash executor is not initialized");
      return bash.listDir(input);
    },
  };
}
