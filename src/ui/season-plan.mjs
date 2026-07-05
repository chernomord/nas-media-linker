function normalizePlanName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function padSeasonNumber(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return "";
  }
  return String(Number(raw)).padStart(2, "0");
}

function inferSeasonFromName(name) {
  const normalized = normalizePlanName(name);
  if (!normalized) {
    return "";
  }

  const patterns = [
    /\bseason\s*0*(\d{1,2})\b/i,
    /\bs\s*0*(\d{1,2})\b/i,
    /\b0*(\d{1,2})x\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return padSeasonNumber(match[1]);
    }
  }

  return "";
}

function isIgnoredFolderName(name) {
  const normalized = normalizePlanName(name);
  if (!normalized) {
    return false;
  }

  const patterns = [
    /\bspecials?\b/i,
    /\bextras?\b/i,
    /\bbonus(?:es)?\b/i,
    /\bova\b/i,
    /\bbehind the scenes?\b/i,
    /\bdeleted scenes?\b/i,
    /\bfeaturettes?\b/i,
    /\btrailers?\b/i,
    /\bteasers?\b/i,
    /\bsamples?\b/i,
    /\binterviews?\b/i,
    /\bpromos?\b/i,
    /\brecaps?\b/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function normalizeRootEntry(entry) {
  return {
    path: String(entry?.path ?? "").trim(),
    name: String(entry?.name ?? "").trim(),
    type: entry?.type === "d" ? "d" : "f",
  };
}

export function classifySeasonPlanRow(entry) {
  const normalized = normalizeRootEntry(entry);
  const inferredSeason = normalized.type === "d" ? inferSeasonFromName(normalized.name) : "";

  if (normalized.type !== "d") {
    return {
      path: normalized.path,
      name: normalized.name,
      type: normalized.type,
      hint: "ignored",
      reason: "root file",
      inferredSeason: "",
      include: false,
      seasonOverride: "",
      resultStatus: "",
      resultMessage: "",
    };
  }

  if (isIgnoredFolderName(normalized.name)) {
    return {
      path: normalized.path,
      name: normalized.name,
      type: normalized.type,
      hint: "ignored",
      reason: "special folder",
      inferredSeason,
      include: false,
      seasonOverride: inferredSeason,
      resultStatus: "",
      resultMessage: "",
    };
  }

  if (inferredSeason) {
    return {
      path: normalized.path,
      name: normalized.name,
      type: normalized.type,
      hint: "candidate",
      reason: `season ${inferredSeason}`,
      inferredSeason,
      include: true,
      seasonOverride: inferredSeason,
      resultStatus: "",
      resultMessage: "",
    };
  }

  return {
    path: normalized.path,
    name: normalized.name,
    type: normalized.type,
    hint: "ambiguous",
    reason: "no season token",
    inferredSeason: "",
    include: false,
    seasonOverride: "",
    resultStatus: "",
    resultMessage: "",
  };
}

export function buildSeasonPlan(rootPath, items) {
  const rows = [];
  let folderCount = 0;
  let candidateCount = 0;
  let ignoredCount = 0;
  let ambiguousCount = 0;
  let rootFileCount = 0;

  for (const item of Array.isArray(items) ? items : []) {
    if (item?.type !== "d") {
      rootFileCount += 1;
      continue;
    }

    folderCount += 1;
    const row = classifySeasonPlanRow({
      path: item.path,
      name: item.name,
      type: item.type,
    });
    rows.push(row);
    if (row.hint === "candidate") {
      candidateCount += 1;
    } else if (row.hint === "ignored") {
      ignoredCount += 1;
    } else {
      ambiguousCount += 1;
    }
  }

  return {
    rootPath: String(rootPath ?? "").trim(),
    rows,
    summary: {
      folderCount,
      candidateCount,
      ignoredCount,
      ambiguousCount,
      rootFileCount,
    },
  };
}

export function resolveSeasonPlanRowSeason(row) {
  return padSeasonNumber(row?.seasonOverride || row?.inferredSeason || "");
}
