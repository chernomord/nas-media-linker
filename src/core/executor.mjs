import path from "node:path";
import { promises as fsp } from "node:fs";

export const TORRENTS_ROOT = "/volume1/Movies/qbt-downloads";
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

function rejectUnsafePath(value) {
  if (typeof value !== "string") {
    throw new ExecutorInputError("Path must be a string");
  }
  if (/(^|\/)\.\.(\/|$)/.test(value)) {
    throw new ExecutorInputError("Path contains .. segment");
  }
  if (/[\x00-\x1F\x7F]/.test(value)) {
    throw new ExecutorInputError("Control characters in path");
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

function entryUid(entryPath, stat) {
  if (stat && Number.isInteger(stat.dev) && Number.isInteger(stat.ino)) {
    return `${stat.dev}:${stat.ino}`;
  }
  return entryPath;
}

export function isUnder(value, root) {
  if (typeof value !== "string") return false;
  if (/(^|\/)\.\.(\/|$)/.test(value)) return false;
  return value === root || value.startsWith(root + "/");
}

export function isAllowedListDir(dir, roots = DEFAULT_ROOTS) {
  if (typeof dir !== "string") return false;
  return [roots.torrents, roots.movies, roots.tv].some(
    (root) => dir === root || dir.startsWith(root + "/"),
  );
}

function sanitizeName(value) {
  return String(value).replaceAll("/", "-").replaceAll("\n", " ");
}

function isVideoFilename(name) {
  return [".mkv", ".mp4", ".avi", ".m4v"].some((ext) => name.endsWith(ext));
}

function extractEpisodeNumber(name) {
  const stem = path.posix.basename(name, path.posix.extname(name));
  const canonicalMatch = stem.match(
    /(?:^|[^A-Z0-9])S\d{1,2}E(\d{1,3})(?:[^0-9]|$)/i,
  );
  if (canonicalMatch) {
    return Number(canonicalMatch[1]);
  }

  const trailingMatch = stem.match(
    /(?:^|[^\d])(\d{1,3})(?=(?:\s*\[[^\]]*\])?$)/,
  );
  if (trailingMatch) {
    return Number(trailingMatch[1]);
  }

  return null;
}

function buildSeasonEpisodeName(season, episode, ext) {
  return `S${pad2(season)}E${pad2(episode)}${ext}`;
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
      throw new ExecutorInputError(
        `Multiple video files in directory, pass exact file path: ${src}`,
      );
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

async function clearDirectoryContents(dir) {
  let names = [];
  try {
    names = await fsp.readdir(dir);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return 0;
  }

  for (const name of sortByPathByteOrder(names)) {
    await fsp.rm(path.posix.join(dir, name), { recursive: true, force: true });
  }

  return names.length;
}

export function createExecutor({ roots: rootOverrides = {} } = {}) {
  const roots = {
    torrents: DEFAULT_ROOTS.torrents,
    movies: DEFAULT_ROOTS.movies,
    tv: DEFAULT_ROOTS.tv,
    ...rootOverrides,
  };

  return {
    mode: "node",

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
        return {
          code: errorCode(error),
          stdout: "",
          stderr: formatExecutorError(error),
        };
      }
    },

    async linkSeason({ srcDir, title, season, year, resetTarget = false }) {
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
        const shouldResetTarget = resetTarget === true;
        const cleanedCount = shouldResetTarget
          ? await clearDirectoryContents(dstDir)
          : 0;
        await fsp.mkdir(dstDir, { recursive: true });

        const existingEntries = [];
        let highestEpisode = 0;
        if (!shouldResetTarget) {
          const existingNames = await fsp.readdir(dstDir);
          for (const name of sortByPathByteOrder(existingNames)) {
            if (!isVideoFilename(name)) continue;
            const entryPath = path.posix.join(dstDir, name);
            try {
              const stat = await fsp.stat(entryPath);
              if (!stat.isFile()) continue;
              const episodeNumber = extractEpisodeNumber(name);
              if (
                Number.isInteger(episodeNumber) &&
                episodeNumber > highestEpisode
              ) {
                highestEpisode = episodeNumber;
              }
              existingEntries.push({
                path: entryPath,
                dev: stat.dev,
                ino: stat.ino,
              });
            } catch {
              // Keep linking stable even if one existing file vanishes mid-run.
            }
          }
        }

        let nextEpisode = shouldResetTarget
          ? 1
          : Math.max(highestEpisode, existingEntries.length) + 1;

        const lines = [];
        if (shouldResetTarget) {
          lines.push(`  cleaned: ${cleanedCount}`);
          lines.push("  reset_target: yes");
        }
        let linkedCount = 0;
        let skippedCount = 0;
        for (const src of files) {
          const srcStat = await fsp.stat(src);
          const existingLink = existingEntries.find(
            (entry) => entry.dev === srcStat.dev && entry.ino === srcStat.ino,
          );
          if (existingLink) {
            skippedCount += 1;
            lines.push(`  = ${existingLink.path} (already linked)`);
            continue;
          }

          const ext = path.posix.extname(src);
          let dst = "";
          while (true) {
            const candidateName = buildSeasonEpisodeName(
              paddedSeason,
              nextEpisode,
              ext,
            );
            dst = path.posix.join(dstDir, candidateName);
            try {
              const existing = await fsp.stat(dst);
              if (!existing.isFile()) {
                throw new ExecutorInputError(
                  `Destination exists and is not a file: ${dst}`,
                );
              }
              if (
                existing.dev === srcStat.dev &&
                existing.ino === srcStat.ino
              ) {
                skippedCount += 1;
                lines.push(`  = ${dst} (already linked)`);
                break;
              }
              nextEpisode += 1;
              continue;
            } catch (error) {
              if (error?.code !== "ENOENT") throw error;
              await replaceHardlink(src, dst);
              linkedCount += 1;
              lines.push(`  ${src}`);
              lines.push(`  -> ${dst}`);
              existingEntries.push({
                path: dst,
                dev: srcStat.dev,
                ino: srcStat.ino,
              });
              nextEpisode += 1;
              break;
            }
          }
        }

        lines.push("Linked season:");
        lines.push(`  show: ${safeTitle} (${year})`);
        lines.push(`  season: ${paddedSeason}`);
        lines.push(`  linked: ${linkedCount}`);
        lines.push(`  skipped: ${skippedCount}`);
        lines.push(`  from: ${srcDir}`);
        lines.push(`  to: ${dstDir}`);

        return {
          code: 0,
          stdout: `${lines.join("\n")}\n`,
          stderr: "",
        };
      } catch (error) {
        return {
          code: errorCode(error),
          stdout: "",
          stderr: formatExecutorError(error),
        };
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
        const paths = sortByPathByteOrder(
          names.map((name) => path.posix.join(dir, name)),
        );
        const items = [];

        for (const entryPath of paths) {
          let type = "f";
          let size = "-";
          let mtime = "-";
          let uid = entryPath;

          try {
            const stat = await fsp.stat(entryPath);
            type = stat.isDirectory() ? "d" : "f";
            size = stat.isDirectory() ? "-" : String(stat.size);
            mtime = formatStatTime(stat);
            uid = entryUid(entryPath, stat);
          } catch {
            // Keep listing stable even if stat fails for a single entry.
          }

          items.push({
            uid,
            path: entryPath,
            type,
            name: path.posix.basename(entryPath),
            size,
            mtime,
          });
        }

        return { ok: true, code: 0, items };
      } catch (error) {
        return {
          ok: false,
          code: errorCode(error),
          stderr: formatExecutorError(error),
        };
      }
    },
  };
}
