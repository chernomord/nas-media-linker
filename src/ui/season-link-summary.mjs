function parseCount(stdout, label) {
  const text = String(stdout ?? "");
  const match = text.match(new RegExp(`^\\s*${label}:\\s*(\\d+)\\s*$`, "m"));
  return match ? Number(match[1]) : 0;
}

export function parseSeasonLinkSummary(stdout) {
  return {
    linked: parseCount(stdout, "linked"),
    skipped: parseCount(stdout, "skipped"),
  };
}
