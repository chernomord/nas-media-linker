import fs from "node:fs";

import { MOVIES_ROOT, TORRENTS_ROOT, TV_ROOT } from "../../lib/executor.mjs";

const UI_TEMPLATE = fs.readFileSync(new URL("../templates/app-shell.html", import.meta.url), "utf8");
const LOGIN_TEMPLATE = fs.readFileSync(new URL("../templates/login-shell.html", import.meta.url), "utf8");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildUiHtml(runToken) {
  return UI_TEMPLATE
    .replaceAll("__RUN_TOKEN__", escapeHtml(runToken))
    .replaceAll("__TORRENTS_ROOT__", escapeHtml(TORRENTS_ROOT))
    .replaceAll("__MOVIES_ROOT__", escapeHtml(MOVIES_ROOT))
    .replaceAll("__TV_ROOT__", escapeHtml(TV_ROOT));
}

export function buildLoginHtml() {
  return LOGIN_TEMPLATE;
}
