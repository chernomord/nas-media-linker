function normalizeLegacySourceName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createTorrentSourceIndex(rootPath, items) {
  const byUid = new Map();
  const byPath = new Map();
  const entries = [];

  for (const item of Array.isArray(items) ? items : []) {
    const path = `${rootPath}/${item.name}`;
    const uid = String(item.uid ?? path).trim() || path;
    const entry = {
      uid,
      path,
      name: item.name,
      type: item.type,
    };
    entries.push(entry);
    byUid.set(uid, entry);
    byPath.set(path, entry);
  }

  return {
    rootPath,
    entries,
    byUid,
    byPath,
  };
}

export function resolveTorrentSourceUidFromPath(srcPath, index) {
  if (typeof srcPath !== "string" || !srcPath) {
    return "";
  }
  const rootPath = index?.rootPath || "";
  if (!rootPath || !(srcPath === rootPath || srcPath.startsWith(`${rootPath}/`))) {
    return "";
  }

  const exact = index.byPath.get(srcPath);
  if (exact) {
    return exact.uid;
  }

  const topLevelName = srcPath.slice(rootPath.length + 1).split("/")[0];
  const normalizedTarget = normalizeLegacySourceName(topLevelName);
  if (!normalizedTarget) {
    return "";
  }

  const fuzzy = index.entries.find((entry) => normalizeLegacySourceName(entry.name) === normalizedTarget);
  return fuzzy?.uid || "";
}

export function resolveTorrentSourcePathFromUid(uid, index) {
  const rawUid = String(uid ?? "").trim();
  if (!rawUid) {
    return "";
  }
  return index?.byUid.get(rawUid)?.path || "";
}

export function resolveSavedTorrentSourceUid(savedItem, index) {
  const sourceId = String(savedItem?.sourceId ?? "").trim();
  if (sourceId) {
    return sourceId;
  }
  return resolveTorrentSourceUidFromPath(savedItem?.srcPath, index);
}
