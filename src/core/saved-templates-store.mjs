import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

function nowIso() {
  return new Date().toISOString();
}

function normalizeKind(value) {
  return value === "movie" || value === "season" ? value : null;
}

function normalizeYear(value) {
  const year = String(value ?? "").trim();
  if (!/^\d{4}$/.test(year)) return null;
  return Number(year);
}

function normalizeSeason(kind, value) {
  if (kind === "movie") return null;
  const season = String(value ?? "").trim();
  if (!/^\d+$/.test(season)) return null;
  return Number(season);
}

function normalizeSrcPath(value) {
  if (value == null) return null;
  const srcPath = String(value).trim();
  return srcPath === "" ? null : srcPath;
}

function normalizeSourceId(value) {
  if (value == null) return null;
  const sourceId = String(value).trim();
  return sourceId === "" ? null : sourceId;
}

function normalizeTitle(value) {
  const title = String(value ?? "").trim();
  return title === "" ? null : title;
}

function naturalKeyOf(item) {
  if (item.kind === "movie") {
    return `movie|${item.title}|${item.year}`;
  }
  return `season|${item.title}|${item.year}|${item.season}`;
}

function normalizeInput(input) {
  const kind = normalizeKind(input?.kind);
  if (!kind) throw new Error("kind must be movie|season");

  const title = normalizeTitle(input?.title);
  if (!title) throw new Error("title required");

  const year = normalizeYear(input?.year);
  if (year == null) throw new Error("year must be YYYY");

  const season = normalizeSeason(kind, input?.season);
  if (kind === "season" && season == null) {
    throw new Error("season must be numeric");
  }

  const srcPath = normalizeSrcPath(input?.srcPath);
  const sourceId = normalizeSourceId(input?.sourceId);
  return {
    kind,
    title,
    year,
    season,
    srcPath,
    sourceId,
  };
}

function rowToItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    year: row.year,
    season: row.season,
    srcPath: row.src_path,
    sourceId: row.source_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSavedTemplatesStore({ dbPath }) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS saved_templates (
      id TEXT PRIMARY KEY,
      natural_key TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      season INTEGER NULL,
      source_id TEXT NULL,
      src_path TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS saved_templates_updated_at_idx
      ON saved_templates(updated_at DESC, created_at DESC);
  `);

  const savedTemplateColumns = new Set(
    db.prepare(`PRAGMA table_info(saved_templates)`).all().map((row) => row.name),
  );
  if (!savedTemplateColumns.has("source_id")) {
    try {
      db.exec(`ALTER TABLE saved_templates ADD COLUMN source_id TEXT NULL;`);
    } catch (error) {
      if (!String(error?.message ?? "").includes("duplicate column name: source_id")) {
        throw error;
      }
    }
  }

  const listStmt = db.prepare(`
    SELECT id, kind, title, year, season, source_id, src_path, created_at, updated_at
    FROM saved_templates
    ORDER BY updated_at DESC, created_at DESC, title ASC
  `);
  const getByNaturalKeyStmt = db.prepare(`
    SELECT id, kind, title, year, season, source_id, src_path, created_at, updated_at
    FROM saved_templates
    WHERE natural_key = ?
  `);
  const getByIdStmt = db.prepare(`
    SELECT id, kind, title, year, season, source_id, src_path, created_at, updated_at
    FROM saved_templates
    WHERE id = ?
  `);
  const insertStmt = db.prepare(`
    INSERT INTO saved_templates (
      id, natural_key, kind, title, year, season, source_id, src_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE saved_templates
    SET source_id = COALESCE(?, source_id), src_path = ?, updated_at = ?
    WHERE natural_key = ?
  `);
  const deleteStmt = db.prepare(`
    DELETE FROM saved_templates
    WHERE id = ?
  `);

  return {
    list() {
      return listStmt.all().map(rowToItem);
    },

    upsert(input) {
      const normalized = normalizeInput(input);
      const naturalKey = naturalKeyOf(normalized);
      const existing = getByNaturalKeyStmt.get(naturalKey);
      const timestamp = nowIso();

      if (existing) {
        updateStmt.run(normalized.sourceId, normalized.srcPath, timestamp, naturalKey);
        return rowToItem(getByNaturalKeyStmt.get(naturalKey));
      }

      const id =
        globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : crypto.randomUUID();
      insertStmt.run(
        id,
        naturalKey,
        normalized.kind,
        normalized.title,
        normalized.year,
        normalized.season,
        normalized.sourceId,
        normalized.srcPath,
        timestamp,
        timestamp,
      );
      return rowToItem(getByIdStmt.get(id));
    },

    delete(id) {
      const rawId = String(id ?? "").trim();
      if (!rawId) throw new Error("id required");
      deleteStmt.run(rawId);
      return { ok: true };
    },
  };
}
