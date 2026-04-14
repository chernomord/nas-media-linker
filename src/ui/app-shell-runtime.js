import { onLocaleChange, t } from "./i18n/index.js";
import { parseSeasonLinkSummary } from "./season-link-summary.mjs";

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
}

function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!(template instanceof HTMLTemplateElement)) {
    throw new Error(`Missing template: ${id}`);
  }
  return template.content.firstElementChild.cloneNode(true);
}

function initBackgroundEffect() {
  if (!document.body?.classList.contains("app-shell-page")) {
    return;
  }

  const prefersReducedMotion = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "glsl-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: false,
  });
  if (!gl) {
    canvas.remove();
    return;
  }

  const vertexSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    varying vec2 v_uv;

    const float PI = 3.14159265;

    float glow(vec2 p, vec2 c, float r) {
      float d = length(p - c);
      return exp(-r * d * d);
    }

    float hash12(vec2 p) {
      vec3 p3  = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float rayMask(float a, float count, float width) {
      float x = fract(a * count);
      float dist = abs(x - 0.5);
      return smoothstep(width, 0.0, dist);
    }

    void main() {
      vec2 p = (gl_FragCoord.xy / u_res) * 2.0 - 1.0;
      p.x *= u_res.x / u_res.y;

      float t = u_time * 6.2831853;
      vec2 drift = vec2(0.16 * sin(t * 0.7), 0.16 * cos(t * 0.6));
      p += drift;
      float r = length(p);

      vec2 c1 = vec2(0.75 * cos(t * 0.9), 0.60 * sin(t));
      vec2 c2 = vec2(0.70 * cos(t * 1.1 + 2.2), 0.55 * sin(t * 0.8 + 2.2));
      vec2 c3 = vec2(0.60 * cos(t * 0.7 + 4.0), 0.50 * sin(t * 1.2 + 4.0));

      float g1 = glow(p, c1, 2.4);
      float g2 = glow(p, c2, 2.1);
      float g3 = glow(p, c3, 2.6);

      float pulse = 0.78 + 0.22 * sin(t * 2.2);
      vec3 col = vec3(0.03, 0.02, 0.07);
      col += g1 * vec3(0.48, 0.16, 0.85) * pulse;
      col += g2 * vec3(0.12, 0.28, 0.85) * (1.0 - pulse * 0.25);
      col += g3 * vec3(0.70, 0.18, 0.55) * (0.85 + 0.15 * sin(t * 1.6));

      float grad = (p.y * 0.5 + 0.5);
      col += vec3(0.03, 0.01, 0.06) * grad;

      float v = smoothstep(1.25, 0.35, r);
      col *= mix(0.75, 1.0, v);

      float angle = atan(p.y, p.x) + t * 1.3;
      float a = (angle + PI) / (2.0 * PI);
      float rayCountA = 18.0;
      float rayCountB = 11.0;
      float baseIdA = floor(a * rayCountA);
      float baseIdB = floor(a * rayCountB);
      float jitterA = (hash12(vec2(baseIdA, 5.3)) - 0.5) * (0.9 / rayCountA);
      float jitterB = (hash12(vec2(baseIdB, 7.1)) - 0.5) * (1.2 / rayCountB);
      float phaseA = hash12(vec2(baseIdA, 1.7)) * 6.2831853;
      float phaseB = hash12(vec2(baseIdB, 9.2)) * 6.2831853;
      float wobbleA = sin(t * 1.4 + phaseA) * (0.6 / rayCountA);
      float wobbleB = sin(t * 1.0 + phaseB) * (0.5 / rayCountB);
      float aA = a + jitterA + wobbleA;
      float aB = a + jitterB + wobbleB;
      float rayA = rayMask(aA, rayCountA, 0.22);
      float rayB = rayMask(aB, rayCountB, 0.30);
      float ray = clamp(rayA * 0.6 + rayB * 0.5, 0.0, 1.0);
      float rayId = floor(fract(aA) * rayCountA);
      float amp = mix(0.2, 1.0, hash12(vec2(rayId, rayId + 1.7)));
      ray *= amp;

      float edge = smoothstep(0.20, 1.25, r);
      edge *= edge;
      float streak = ray * edge;
      vec3 beamColor = vec3(1.0, 0.94, 0.78);
      float beamStrength = streak * 0.62;
      col *= (1.0 + beamColor * beamStrength);

      float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
      col += dither;

      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("GLSL compile failed:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) {
    canvas.remove();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("GLSL link failed:", gl.getProgramInfoLog(program));
    canvas.remove();
    return;
  }

  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const posLoc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const resLoc = gl.getUniformLocation(program, "u_res");
  const timeLoc = gl.getUniformLocation(program, "u_time");

  const renderScale = 0.5;
  const maxDpr = 1.5;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr * renderScale));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr * renderScale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resLoc, w, h);
    }
  };

  document.body.classList.add("glsl-bg");
  resize();
  window.addEventListener("resize", resize);

  const cycleSeconds = 80;
  const frameInterval = 1000 / 30;
  const start = performance.now();
  let lastFrame = 0;
  let rafId = 0;
  let loopRunning = false;
  let windowFocused = document.hasFocus();
  let pausedAt = null;
  let pausedDuration = 0;

  const draw = (now) => {
    const elapsed = (now - start - pausedDuration) / 1000;
    const t = (elapsed % cycleSeconds) / cycleSeconds;
    gl.uniform1f(timeLoc, t);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const shouldAnimate = () => !prefersReducedMotion && !document.hidden && windowFocused;

  const loop = (now) => {
    if (!shouldAnimate()) {
      loopRunning = false;
      rafId = 0;
      return;
    }
    if (now - lastFrame >= frameInterval) {
      lastFrame = now;
      draw(now);
    }
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (!loopRunning) {
      return;
    }
    if (pausedAt === null) {
      pausedAt = performance.now();
    }
    loopRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const startLoop = () => {
    if (!shouldAnimate() || loopRunning) {
      return;
    }
    if (pausedAt !== null) {
      pausedDuration += performance.now() - pausedAt;
      pausedAt = null;
    }
    lastFrame = 0;
    loopRunning = true;
    rafId = requestAnimationFrame(loop);
  };

  const syncLoopState = () => {
    if (shouldAnimate()) {
      startLoop();
      return;
    }
    stopLoop();
  };

  draw(start);
  startLoop();

  document.addEventListener("visibilitychange", syncLoopState);
  window.addEventListener("focus", () => {
    windowFocused = true;
    syncLoopState();
  });
  window.addEventListener("blur", () => {
    windowFocused = false;
    syncLoopState();
  });
}

function initAppShell() {
  if (!document.body?.classList.contains("app-shell-page")) {
    return;
  }

  const $ = (id) => document.getElementById(id);
  const RUN_TOKEN = document.body.dataset.runToken || "";
  const LS_KEY = "nas_linker_saved";
  const ROOT_PATHS = {
    torrents: document.body.dataset.rootTorrents || "",
    movies: document.body.dataset.rootMovies || "",
    tv: document.body.dataset.rootTv || "",
  };
  const BROWSE_ROW_TEMPLATE_ID = "browse-row-template";
  const SAVED_ROW_TEMPLATE_ID = "saved-row-template";

  let pendingDeleteId = null;
  let savedItemsCache = [];
  let savedItemsLoaded = false;
  let savedItemsError = "";
  let logText = "";
  let sessionFailureState = null;
  let listedRoot = "";
  let listedItems = [];
  let listErrorText = "";

  function renderLog() {
    $("log").textContent = logText;
  }

  function log(t) {
    logText = String(t ?? "");
    renderLog();
  }

  function isSessionExpiredResult(result) {
    return Boolean(result?.sessionExpired);
  }

  function showSessionRecovery(info) {
    sessionFailureState = info;
    $("session_message").textContent = t(info.messageKey);
    $("session_hint").textContent = t(info.hintKey);
    log(`[session] ${info.kind}: ${t(info.messageKey)}`);
    $("session_modal").show();
  }

  function classifySessionFailure(resp) {
    const authMode = (resp.headers.get("x-nas-linker-auth") || "").toLowerCase();
    if (authMode === "session") {
      return {
        kind: "auth",
        messageKey: "session.auth_lost",
        hintKey: "session.auth_hint",
      };
    }
    return {
      kind: "runtime",
      messageKey: "session.runtime_changed",
      hintKey: "session.runtime_hint",
    };
  }

  function setStatus(id, kind, text) {
    const el = $(id);
    el.classList.remove("hidden");
    const variant =
      kind === "ok" ? "success" :
      kind === "error" ? "danger" :
      kind === "warn" ? "warning" :
      "neutral";
    el.setAttribute("variant", variant);
    el.textContent = text;
  }

  function setSearchStatus(id, kind, text) {
    setStatus(id, kind, t("status.search_prefix", { text }));
  }

  function setLinkStatus(id, kind, text) {
    setStatus(id, kind, t("status.link_prefix", { text }));
  }

  function toast(kind, title, message) {
    try {
      const alert = document.createElement("sl-alert");
      alert.variant =
        kind === "ok" ? "success" :
        kind === "error" ? "danger" :
        kind === "warn" ? "warning" :
        "primary";
      alert.closable = true;
      alert.duration = 3000;
      alert.innerHTML = `<strong>${title}</strong><br/>${message}`;
      document.body.appendChild(alert);

      if (typeof alert.toast === "function") {
        alert.toast();
        alert.addEventListener("sl-after-hide", () => alert.remove());
        return;
      }

      alert.open = true;
      setTimeout(() => {
        alert.remove();
      }, 3000);
    } catch (error) {
      console.error("Toast failed", error);
      log(`[toast-fallback] ${title}: ${message}`);
    }
  }

  const FLOATING_TOOLTIP_PORTAL_ID = "floating_tooltip_portal";
  let activeFloatingTooltip = null;
  let activeFloatingTooltipAnchor = null;
  let floatingTooltipListenersBound = false;

  function ensureFloatingTooltipPortal() {
    let portal = document.getElementById(FLOATING_TOOLTIP_PORTAL_ID);
    if (portal) return portal;

    portal = document.createElement("div");
    portal.id = FLOATING_TOOLTIP_PORTAL_ID;
    portal.className = "floating-tooltip-portal";
    portal.setAttribute("aria-hidden", "true");

    const tooltip = document.createElement("div");
    tooltip.dataset.role = "floating-tooltip";
    tooltip.className = "floating-tooltip";
    tooltip.hidden = true;
    portal.appendChild(tooltip);

    document.body.appendChild(portal);
    return portal;
  }

  function positionFloatingTooltip() {
    if (!activeFloatingTooltip || !activeFloatingTooltipAnchor) return;

    const tooltip = activeFloatingTooltip;
    const anchor = activeFloatingTooltipAnchor;
    const rect = anchor.getBoundingClientRect();
    const gap = 10;
    const arrow = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

    tooltip.hidden = false;
    tooltip.style.visibility = "hidden";
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    const tooltipRect = tooltip.getBoundingClientRect();
    const placeAbove = rect.top >= tooltipRect.height + gap + arrow + 8;
    const rawTop = placeAbove
      ? rect.top - tooltipRect.height - gap - arrow
      : rect.bottom + gap + arrow;
    const top = Math.max(gap, Math.min(rawTop, viewportHeight - gap - tooltipRect.height));
    const rawLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(gap, Math.min(rawLeft, viewportWidth - gap - tooltipRect.width));

    tooltip.dataset.placement = placeAbove ? "top" : "bottom";
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.visibility = "visible";
  }

  function showFloatingTooltip(anchor, content) {
    if (!content) return;
    const portal = ensureFloatingTooltipPortal();
    const tooltip = portal.querySelector('[data-role="floating-tooltip"]');
    if (!(tooltip instanceof HTMLElement)) return;

    activeFloatingTooltip = tooltip;
    activeFloatingTooltipAnchor = anchor;
    tooltip.textContent = content;
    tooltip.hidden = false;
    positionFloatingTooltip();

    if (!floatingTooltipListenersBound) {
      window.addEventListener("scroll", positionFloatingTooltip, true);
      window.addEventListener("resize", positionFloatingTooltip);
      floatingTooltipListenersBound = true;
    }
  }

  function hideFloatingTooltip() {
    if (!activeFloatingTooltip) return;
    activeFloatingTooltip.hidden = true;
    activeFloatingTooltip = null;
    activeFloatingTooltipAnchor = null;

    if (floatingTooltipListenersBound) {
      window.removeEventListener("scroll", positionFloatingTooltip, true);
      window.removeEventListener("resize", positionFloatingTooltip);
      floatingTooltipListenersBound = false;
    }
  }

  function bindFloatingTooltip(anchor, content) {
    const show = () => showFloatingTooltip(anchor, content);
    const hide = () => hideFloatingTooltip();

    anchor.addEventListener("pointerenter", show);
    anchor.addEventListener("mouseenter", show);
    anchor.addEventListener("focusin", show);
    anchor.addEventListener("pointerleave", hide);
    anchor.addEventListener("mouseleave", hide);
    anchor.addEventListener("focusout", hide);
  }

  function showTransientTooltip(anchor, content, durationMs = 1500) {
    if (!content) return;
    showFloatingTooltip(anchor, content);
    window.setTimeout(() => {
      if (activeFloatingTooltipAnchor === anchor) {
        hideFloatingTooltip();
      }
    }, durationMs);
  }

  async function requestJson(url, { method = "GET", body } = {}) {
    if (sessionFailureState) {
      showSessionRecovery(sessionFailureState);
      return {
        ok: false,
        status: 401,
        data: { ok: false, error: "session expired" },
        sessionExpired: true,
      };
    }

    const headers = {
      "x-run-token": RUN_TOKEN,
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const resp = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));
    if (resp.status === 401 || resp.status === 403) {
      const info = classifySessionFailure(resp);
      showSessionRecovery(info);
      return {
        ok: false,
        status: resp.status,
        data,
        sessionExpired: true,
      };
    }

    const ok = resp.ok && (data.ok !== false);
    return { ok, status: resp.status, data, sessionExpired: false };
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      ta.remove();
    }
  }

  function flashField(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 700);
  }

  function inputValue(id) {
    const el = $(id);
    return String(el?.value ?? "").trim();
  }

  function debounce(fn, delayMs) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delayMs);
    };
  }

  const debouncedMoviePreview = debounce(async () => {
    const title = $("m_title").value.trim();
    const year = $("m_year").value.trim();
    if (title.length < 2) {
      hideAutocomplete("m_ac");
      return;
    }
    const result = await fetchPreview("movie", title, year, 8);
    if (!result.ok) {
      hideAutocomplete("m_ac");
      return;
    }
    renderAutocomplete("m_ac", result.data?.items ?? [], "movie");
  }, 350);

  const debouncedShowPreview = debounce(async () => {
    const title = $("s_title").value.trim();
    const year = $("s_year").value.trim();
    if (title.length < 2) {
      hideAutocomplete("s_ac");
      return;
    }
    const result = await fetchPreview("show", title, year, 8);
    if (!result.ok) {
      hideAutocomplete("s_ac");
      return;
    }
    renderAutocomplete("s_ac", result.data?.items ?? [], "show");
  }, 350);

  $("clear_log").onclick = () => log("");
  $("open_log").onclick = () => $("log_modal").show();

  function readLegacySaved() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readSaved() {
    return savedItemsCache.slice();
  }

  function mapSavedServerItem(item) {
    return {
      id: item.id,
      type: item.kind,
      src: item.kind === "movie" ? (item.srcPath || "") : "",
      srcDir: item.kind === "season" ? (item.srcPath || "") : "",
      title: item.title,
      season: item.season != null ? String(item.season) : "",
      year: item.year != null ? String(item.year) : "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
    };
  }

  function mapEntryToSavedPayload(entry) {
    return {
      kind: entry.type,
      title: entry.title,
      year: entry.year,
      season: entry.type === "season" ? entry.season : undefined,
      srcPath: entry.type === "movie" ? entry.src : entry.srcDir,
    };
  }

  async function getJson(url) {
    return requestJson(url);
  }

  async function loadSavedItems() {
    const result = await getJson("/api/saved-templates");
    if (isSessionExpiredResult(result)) {
      return result;
    }
    if (!result.ok) {
      savedItemsCache = [];
      savedItemsLoaded = true;
      savedItemsError = result.data?.error || `HTTP ${result.status}`;
      renderSaved();
      return result;
    }
    savedItemsCache = (result.data?.items ?? []).map(mapSavedServerItem);
    savedItemsLoaded = true;
    savedItemsError = "";
    renderSaved();
    return result;
  }

  async function bootstrapSavedFromLocalStorageIfNeeded() {
    const legacyItems = readLegacySaved();
    if (savedItemsCache.length > 0 || legacyItems.length === 0) return;

    for (const entry of legacyItems) {
      const payload = mapEntryToSavedPayload(entry);
      const result = await postJson("/api/saved-templates", payload);
      if (isSessionExpiredResult(result)) {
        return;
      }
      if (!result.ok) {
        console.error("Failed to bootstrap saved template", result);
        savedItemsError = t("toast.saved_load_failed");
        break;
      }
    }

    await loadSavedItems();
  }

  async function initSavedItems() {
    const result = await loadSavedItems();
    if (isSessionExpiredResult(result)) {
      return;
    }
    if (!result.ok) {
      toast("error", t("toast.saved_unavailable"), savedItemsError || t("toast.saved_load_failed"));
      return;
    }
    await bootstrapSavedFromLocalStorageIfNeeded();
  }

  async function saveItem(entry) {
    const result = await postJson("/api/saved-templates", mapEntryToSavedPayload(entry));
    if (isSessionExpiredResult(result)) {
      return false;
    }
    if (!result.ok) {
      const message = result.data?.error || `HTTP ${result.status}`;
      toast("error", t("toast.save_failed"), message);
      return false;
    }
    await loadSavedItems();
    return true;
  }

  async function deleteSavedItem(id) {
    const result = await postJson("/api/saved-templates/delete", { id });
    if (isSessionExpiredResult(result)) {
      return false;
    }
    if (!result.ok) {
      const message = result.data?.error || `HTTP ${result.status}`;
      toast("error", t("toast.delete_failed"), message);
      return false;
    }
    await loadSavedItems();
    return true;
  }

  function isChecked(id) {
    const el = $(id);
    return Boolean(el?.checked || el?.hasAttribute("checked"));
  }

  function movieEntryFromForm() {
    return {
      type: "movie",
      src: inputValue("m_src"),
      title: inputValue("m_title"),
      year: inputValue("m_year"),
    };
  }

  function seasonEntryFromForm() {
    return {
      type: "season",
      srcDir: inputValue("s_src"),
      title: inputValue("s_title"),
      season: inputValue("s_season"),
      year: inputValue("s_year"),
    };
  }

  function movieFormData() {
    return {
      src: inputValue("m_src"),
      title: inputValue("m_title"),
      year: inputValue("m_year"),
    };
  }

  function seasonFormData() {
    return {
      srcDir: inputValue("s_src"),
      title: inputValue("s_title"),
      season: inputValue("s_season"),
      year: inputValue("s_year"),
      resetTarget: Boolean($("s_reset_target")?.checked),
    };
  }

  function firstInvalidFieldId(kind) {
    const data = kind === "movie" ? movieFormData() : seasonFormData();
    if (kind === "movie") {
      if (!data.src) return "m_src";
      if (!data.title) return "m_title";
      if (!/^\d{4}$/.test(data.year)) return "m_year";
      return null;
    }
    if (!data.srcDir) return "s_src";
    if (!data.title) return "s_title";
    if (!/^\d+$/.test(data.season)) return "s_season";
    if (!/^\d{4}$/.test(data.year)) return "s_year";
    return null;
  }

  function validationMessage(kind) {
    const data = kind === "movie" ? movieFormData() : seasonFormData();
    if (kind === "movie") {
      if (!data.src) return t("validation.movie.need_source");
      if (!data.title) return t("validation.need_title");
      if (!data.year) return t("validation.need_year");
      if (!/^\d{4}$/.test(data.year)) return t("validation.year_format");
      return "";
    }
    if (!data.srcDir) return t("validation.season.need_source");
    if (!data.title) return t("validation.need_title");
    if (!data.season) return t("validation.need_season");
    if (!/^\d+$/.test(data.season)) return t("validation.season_numeric");
    if (!data.year) return t("validation.need_year");
    if (!/^\d{4}$/.test(data.year)) return t("validation.year_format");
    return "";
  }

  function isFormValid(kind) {
    return validationMessage(kind) === "";
  }

  function syncRunButtons() {
    $("m_run").disabled = !isFormValid("movie");
    $("s_run").disabled = !isFormValid("season");
  }

  function showValidationError(kind) {
    const statusId = kind === "movie" ? "m_status" : "s_status";
    const fieldId = firstInvalidFieldId(kind);
    const message = validationMessage(kind);
    if (fieldId) flashField(fieldId);
    if (message) setLinkStatus(statusId, "warn", message);
  }

  function seasonLinkMessage(result) {
    const codePart = result.data?.code != null ? t("status.exit_code", { code: result.data.code }) : "";
    const summary = parseSeasonLinkSummary(result.data?.stdout);
    if (summary.skipped > 0) {
      return {
        kind: "warn",
        message: t("status.ok_http_partial", {
          status: result.status,
          codePart,
          skipped: summary.skipped,
        }),
      };
    }
    return {
      kind: "ok",
      message: t("status.ok_http", { status: result.status, codePart }),
    };
  }

  function renderSaved() {
    const list = $("saved_list");
    const items = readSaved();
    hideFloatingTooltip();
    list.innerHTML = "";
    if (!savedItemsLoaded) {
      const loading = document.createElement("sl-alert");
      loading.variant = "neutral";
      loading.open = true;
      loading.className = "text-xs";
      loading.textContent = t("saved.loading");
      list.appendChild(loading);
      return;
    }
    if (savedItemsError) {
      const error = document.createElement("sl-alert");
      error.variant = "warning";
      error.open = true;
      error.className = "text-xs";
      error.textContent = t("saved.unavailable", { error: savedItemsError });
      list.appendChild(error);
      return;
    }
    if (items.length === 0) {
      const empty = document.createElement("sl-alert");
      empty.variant = "neutral";
      empty.open = true;
      empty.className = "text-xs";
      empty.textContent = t("saved.empty");
      list.appendChild(empty);
      return;
    }

    for (const it of items) {
      const li = cloneTemplate(SAVED_ROW_TEMPLATE_ID);
      const icon = li.querySelector('[data-role="icon"]');
      const nameHost = li.querySelector('[data-role="name-host"]');
      const actions = li.querySelector('[data-role="actions"]');
      const nameNode = document.createElement("span");
      const iconName = it.type === "movie" ? "film" : "folder";
      const iconColor = it.type === "movie" ? "text-slate-500" : "text-amber-600";
      const displayName = `${it.title}${it.type === "season" ? ` • S${it.season}` : ""} • ${it.year}`;

      icon.setAttribute("name", iconName);
      icon.className = `${iconColor} flex-shrink-0`;

      nameNode.dataset.role = "name";
      nameNode.className = "block min-w-0 flex-1 truncate";
      nameNode.textContent = displayName;
      nameHost.appendChild(nameNode);
      bindFloatingTooltip(nameHost, displayName);

      const fillBtn = document.createElement("sl-button");
      fillBtn.setAttribute("size", "small");
      fillBtn.setAttribute("variant", "text");
      const fillIcon = document.createElement("sl-icon");
      fillIcon.setAttribute("name", "box-arrow-in-right");
      fillIcon.className = "text-blue-600";
      fillBtn.appendChild(fillIcon);
      fillBtn.onclick = () => {
        if (it.type === "movie") {
          $("m_src").value = it.src || "";
          $("m_title").value = it.title;
          $("m_year").value = it.year;
          flashField("m_src");
          flashField("m_title");
          flashField("m_year");
          showPreviewFromFields("movie");
        } else {
          $("s_src").value = it.srcDir || "";
          $("s_title").value = it.title;
          $("s_season").value = it.season;
          $("s_year").value = it.year;
          $("s_reset_target").checked = false;
          flashField("s_src");
          flashField("s_title");
          flashField("s_season");
          flashField("s_year");
          showPreviewFromFields("show");
        }
        syncRunButtons();
      };
      actions.appendChild(fillBtn);
      bindFloatingTooltip(fillBtn, t("saved.fill_form"));

      const delBtn = document.createElement("sl-button");
      delBtn.setAttribute("size", "small");
      delBtn.setAttribute("variant", "text");
      const delIcon = document.createElement("sl-icon");
      delIcon.setAttribute("name", "trash");
      delIcon.className = "text-rose-600";
      delBtn.appendChild(delIcon);
      delBtn.onclick = () => {
        pendingDeleteId = it.id;
        $("confirm_delete").show();
      };
      actions.appendChild(delBtn);
      bindFloatingTooltip(delBtn, t("saved.delete"));

      list.appendChild(li);
    }
  }

  function renderBrowseList(root, items) {
    const ul = $("list");
    hideFloatingTooltip();
    ul.innerHTML = "";
    for (const it of items) {
      const li = cloneTemplate(BROWSE_ROW_TEMPLATE_ID);
      const icon = li.querySelector('[data-role="icon"]');
      const nameHost = li.querySelector('[data-role="name-host"]');
      const copyBtn = li.querySelector('[data-role="copy-btn"]');
      const fillBtn = li.querySelector('[data-role="fill-btn"]');
      const nameNode = document.createElement("span");
      const iconName = it.type === "d" ? "folder" : "film";
      const iconColor = it.type === "d" ? "text-amber-600" : "text-slate-500";
      const displayName = it.name;

      icon.setAttribute("name", iconName);
      icon.className = `${iconColor} flex-shrink-0`;

      nameNode.dataset.role = "name";
      nameNode.className = "block min-w-0 flex-1 truncate";
      nameNode.textContent = displayName;
      nameHost.appendChild(nameNode);
      bindFloatingTooltip(nameHost, displayName);

      bindFloatingTooltip(copyBtn, t("browse.copy_path"));
      copyBtn.onclick = async () => {
        const path = `${root}/${it.name}`;
        try {
          await navigator.clipboard.writeText(path);
          showTransientTooltip(copyBtn, t("browse.copied"));
        } catch {
          const ok = fallbackCopy(path);
          if (ok) {
            showTransientTooltip(copyBtn, t("browse.copied"));
          } else {
            log(t("browse.clipboard_error"));
          }
        }
      };
      bindFloatingTooltip(fillBtn, t("browse.fill_inputs"));
      fillBtn.onclick = () => {
        if (it.type === "d") {
          $("m_src").value = `${root}/${it.name}`;
          $("s_src").value = `${root}/${it.name}`;
          $("s_reset_target").checked = false;
          flashField("m_src");
          flashField("s_src");
          syncRunButtons();
        }
      };
      if (it.type !== "d") {
        fillBtn.disabled = true;
        fillBtn.setAttribute("aria-disabled", "true");
      }

      ul.appendChild(li);
    }
  }

  function openPreviewModal(url) {
    if (!url) return;
    const modal = $("preview_modal");
    const img = $("preview_modal_img");
    img.src = url;
    modal.show();
  }

  async function post(url, body) {
    const result = await requestJson(url, {
      method: "POST",
      body,
    });
    const data = result.data || {};
    const text =
      `HTTP ${result.status}\n` +
      (data.stdout || "") +
      (data.stderr ? (`\n[stderr]\n${data.stderr}`) : "");
    return { ok: result.ok, status: result.status, data, text, sessionExpired: result.sessionExpired };
  }

  async function postJson(url, body) {
    return requestJson(url, {
      method: "POST",
      body,
    });
  }

  const AUTOCOMPLETE_PORTAL_ID = "autocomplete_portal";

  function ensureAutocompletePortal() {
    let portal = document.getElementById(AUTOCOMPLETE_PORTAL_ID);
    if (portal) return portal;
    portal = document.createElement("div");
    portal.id = AUTOCOMPLETE_PORTAL_ID;
    portal.className = "autocomplete-portal";
    portal.style.position = "fixed";
    portal.style.inset = "0";
    portal.style.zIndex = "60";
    portal.style.pointerEvents = "none";
    document.body.appendChild(portal);
    return portal;
  }

  function autocompleteAnchor(listId) {
    return document.querySelector(`[data-autocomplete-anchor="${listId}"]`);
  }

  function repositionAutocomplete(listId) {
    const list = $(listId);
    const anchor = autocompleteAnchor(listId);
    if (!list || !anchor || list.classList.contains("hidden")) return;

    const portal = ensureAutocompletePortal();
    if (list.parentElement !== portal) {
      portal.appendChild(list);
    }

    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const maxWidth = Math.max(0, viewportWidth - gap * 2);
    const width = maxWidth === 0 ? rect.width : Math.min(Math.max(rect.width, 240), maxWidth);
    const left = Math.max(gap, Math.min(rect.left, Math.max(gap, viewportWidth - width - gap)));
    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(0, openUp ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(256, Math.max(80, availableHeight));
    const top = openUp
      ? Math.max(gap, rect.top - gap - Math.min(maxHeight, availableHeight))
      : Math.min(rect.bottom + gap, Math.max(gap, viewportHeight - gap - Math.min(maxHeight, availableHeight)));

    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.width = `${width}px`;
    list.style.maxHeight = `${maxHeight}px`;
  }

  function showAutocomplete(listId) {
    const list = $(listId);
    if (!list) return;
    list.classList.remove("hidden");
    repositionAutocomplete(listId);
  }

  function hideAutocomplete(listId) {
    const list = $(listId);
    if (!list) return;
    list.classList.add("hidden");
    list.innerHTML = "";
    list.style.left = "";
    list.style.top = "";
    list.style.width = "";
    list.style.maxHeight = "";
  }

  function showPreviewList(listId) {
    const list = $(listId);
    if (!list) return;
    list.classList.remove("hidden");
  }

  function renderPreviewCards(listId, items, kind) {
    const list = $(listId);
    list.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("sl-alert");
      empty.variant = "neutral";
      empty.open = true;
      empty.className = "text-xs";
      empty.textContent = t("preview.empty");
      list.appendChild(empty);
      showPreviewList(listId);
      return;
    }

    for (const item of items) {
      const card = document.createElement("div");
      card.className = "flex gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-slate-800";

      const imgWrap = document.createElement("div");
      imgWrap.className = "h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100";
      const img = document.createElement("img");
      img.className = "h-full w-full object-cover preview-cover";
      img.alt = item.title || t("preview.poster_fallback");
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.remove();
        if (imgWrap.querySelector("[data-poster-fallback]")) return;
        const fallback = document.createElement("div");
        fallback.dataset.posterFallback = "true";
        fallback.className = "flex h-full w-full items-center justify-center bg-slate-200 text-lg font-semibold text-slate-500";
        fallback.textContent = (item.title || "?").trim().charAt(0).toUpperCase() || "?";
        imgWrap.appendChild(fallback);
      };
      if (item.thumbUrl) {
        img.src = item.thumbUrl;
      }
      img.onclick = () => openPreviewModal(item.thumbUrl);
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);

      const body = document.createElement("div");
      body.className = "flex min-w-0 flex-1 flex-col gap-2";

      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-slate-900 truncate";
      const year = item.year ? ` (${item.year})` : "";
      title.textContent = `${item.title || t("preview.untitled")}${year}`;
      body.appendChild(title);

      if (item.summary) {
        const summary = document.createElement("div");
        summary.className = "text-xs text-slate-600 max-h-16 overflow-hidden";
        summary.textContent = item.summary;
        body.appendChild(summary);
      }

      const metaRow = document.createElement("div");
      metaRow.className = "flex items-center justify-between gap-2";

      const badge = document.createElement("sl-tag");
      badge.setAttribute("size", "small");
      badge.setAttribute("variant", "neutral");
      badge.textContent = t("preview.plex_match");
      metaRow.appendChild(badge);

      const useBtn = document.createElement("sl-button");
      useBtn.setAttribute("size", "small");
      useBtn.setAttribute("variant", "primary");
      useBtn.textContent = t("preview.use");
      useBtn.onclick = () => {
        if (kind === "movie") {
          $("m_title").value = item.title || "";
          if (item.year) $("m_year").value = String(item.year);
          flashField("m_title");
          flashField("m_year");
          setSearchStatus("m_status", "ok", t("status.selected"));
        } else {
          $("s_title").value = item.title || "";
          if (item.year) $("s_year").value = String(item.year);
          flashField("s_title");
          flashField("s_year");
          setSearchStatus("s_status", "ok", t("status.selected"));
        }
        syncRunButtons();
      };
      metaRow.appendChild(useBtn);

      body.appendChild(metaRow);
      card.appendChild(body);
      list.appendChild(card);
    }
    showPreviewList(listId);
  }

  async function fetchPreview(kind, title, year, limit = 8) {
    const result = await postJson("/api/meta/search", {
      kind,
      title,
      year: year || undefined,
      limit,
    });
    return result;
  }

  async function showPreviewFromFields(kind) {
    const isMovie = kind === "movie";
    const titleEl = isMovie ? $("m_title") : $("s_title");
    const yearEl = isMovie ? $("m_year") : $("s_year");
    const listId = isMovie ? "m_preview_list" : "s_preview_list";
    const statusId = isMovie ? "m_status" : "s_status";
    const acId = isMovie ? "m_ac" : "s_ac";
    const title = titleEl?.value?.trim() || "";
    const year = yearEl?.value?.trim() || "";

    if (!title) {
      setSearchStatus(statusId, "warn", t("status.need_title"));
      hideAutocomplete(acId);
      return;
    }
    setSearchStatus(statusId, "info", t("status.searching"));
    const result = await fetchPreview(kind, title, year, 8);
    if (isSessionExpiredResult(result)) {
      setSearchStatus(statusId, "warn", t("status.session_expired"));
      hideAutocomplete(acId);
      return;
    }
    if (!result.ok) {
      setSearchStatus(statusId, "error", t("status.error_http", { status: result.status }));
      hideAutocomplete(acId);
      return;
    }
    hideAutocomplete(acId);
    renderPreviewCards(listId, result.data?.items ?? [], kind);
    setSearchStatus(statusId, "ok", t("status.ready"));
  }

  function renderAutocomplete(listId, items, kind) {
    const list = $(listId);
    list.innerHTML = "";
    if (!items || items.length === 0) {
      hideAutocomplete(listId);
      return;
    }
    showAutocomplete(listId);

    for (const item of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "autocomplete-option";

      const title = document.createElement("div");
      title.className = "autocomplete-option__title";
      const year = item.year ? ` (${item.year})` : "";
      title.textContent = `${item.title || t("preview.untitled")}${year}`;
      row.appendChild(title);

      if (item.type) {
        const typeTag = document.createElement("sl-tag");
        typeTag.setAttribute("size", "small");
        typeTag.setAttribute("variant", "neutral");
        typeTag.textContent = item.type;
        row.appendChild(typeTag);
      }

      row.onclick = () => {
        if (kind === "movie") {
          $("m_title").value = item.title || "";
          if (item.year) $("m_year").value = String(item.year);
          flashField("m_title");
          flashField("m_year");
          setSearchStatus("m_status", "ok", t("status.selected"));
          hideAutocomplete("m_ac");
          renderPreviewCards("m_preview_list", [item], "movie");
        } else {
          $("s_title").value = item.title || "";
          if (item.year) $("s_year").value = String(item.year);
          flashField("s_title");
          flashField("s_year");
          setSearchStatus("s_status", "ok", t("status.selected"));
          hideAutocomplete("s_ac");
          renderPreviewCards("s_preview_list", [item], "show");
        }
        syncRunButtons();
      };

      list.appendChild(row);
    }
  }

  $("m_run").onclick = async () => {
    if (!isFormValid("movie")) {
      showValidationError("movie");
      syncRunButtons();
      return;
    }
    const shouldSave = isChecked("m_save");
    const entry = shouldSave ? movieEntryFromForm() : null;
    setLinkStatus("m_status", "info", t("status.running"));
    try {
      const result = await post("/api/link/movie", {
        src: $("m_src").value,
        title: $("m_title").value,
        year: $("m_year").value,
      });
      if (isSessionExpiredResult(result)) {
        setLinkStatus("m_status", "warn", t("status.session_expired"));
        return;
      }
      log(result.text);
      const codePart = result.data?.code != null ? t("status.exit_code", { code: result.data.code }) : "";
      if (result.ok) {
        const message = t("status.ok_http", { status: result.status, codePart });
        setLinkStatus("m_status", "ok", message);
        toast("ok", t("toast.movie_linked"), `HTTP ${result.status}${codePart}`);
      } else {
        const message = t("status.error_http", { status: result.status }) + codePart;
        setLinkStatus("m_status", "error", message);
        toast("error", t("toast.movie_failed"), `HTTP ${result.status}${codePart}`);
      }
    } catch (error) {
      console.error("Movie link request failed", error);
      setLinkStatus("m_status", "error", t("status.request_failed"));
      toast("error", t("toast.movie_failed"), t("toast.request_error"));
    } finally {
      if (entry) {
        await saveItem(entry);
      }
    }
  };

  $("s_run").onclick = async () => {
    if (!isFormValid("season")) {
      showValidationError("season");
      syncRunButtons();
      return;
    }
    const shouldSave = isChecked("s_save");
    const resetTarget = isChecked("s_reset_target");
    const entry = shouldSave ? seasonEntryFromForm() : null;
    setLinkStatus("s_status", "info", t("status.running"));
    try {
      const result = await post("/api/link/season", {
        srcDir: $("s_src").value,
        title: $("s_title").value,
        season: $("s_season").value,
        year: $("s_year").value,
        resetTarget,
      });
      if (isSessionExpiredResult(result)) {
        setLinkStatus("s_status", "warn", t("status.session_expired"));
        return;
      }
      log(result.text);
      const codePart = result.data?.code != null ? t("status.exit_code", { code: result.data.code }) : "";
      if (result.ok) {
        const summary = seasonLinkMessage(result);
        setLinkStatus("s_status", summary.kind, summary.message);
        if (summary.kind === "warn") {
          toast("warn", t("toast.season_partial"), summary.message);
        } else {
          toast("ok", t("toast.season_linked"), `HTTP ${result.status}${codePart}`);
        }
      } else {
        const message = t("status.error_http", { status: result.status }) + codePart;
        setLinkStatus("s_status", "error", message);
        toast("error", t("toast.season_failed"), `HTTP ${result.status}${codePart}`);
      }
    } catch (error) {
      console.error("Season link request failed", error);
      setLinkStatus("s_status", "error", t("status.request_failed"));
      toast("error", t("toast.season_failed"), t("toast.request_error"));
    } finally {
      if (entry) {
        await saveItem(entry);
      }
      if (resetTarget) {
        $("s_reset_target").checked = false;
      }
    }
  };

  $("browse").onclick = async () => {
    const sel = $("root");
    const opt = sel?.selectedOptions?.[0];
    const root = opt?.dataset?.path || ROOT_PATHS[sel?.value] || "";
    if (!root) {
      log(t("browse.root_not_selected"));
      return;
    }
    $("list").classList.add("hidden");
    $("list_loading").classList.remove("hidden");
    const result = await postJson("/api/list", { dir: root });
    $("list_loading").classList.add("hidden");
    $("list").classList.remove("hidden");
    if (isSessionExpiredResult(result)) {
      log(t("browse.session_expired"));
      listedRoot = root;
      listedItems = [];
      listErrorText = t("browse.session_expired");
      return;
    }
    const data = result.data || {};
    if (!data.ok) {
      const errorText = data.stderr || "error";
      log(errorText);
      listedRoot = root;
      listedItems = [];
      listErrorText = errorText;
      return;
    }
    listedRoot = root;
    listedItems = data.items ?? [];
    listErrorText = "";
    renderBrowseList(listedRoot, listedItems);
  };

  $("m_title").addEventListener("input", debouncedMoviePreview);
  $("m_year").addEventListener("input", debouncedMoviePreview);
  $("s_title").addEventListener("input", debouncedShowPreview);
  $("s_year").addEventListener("input", debouncedShowPreview);
  $("logout_btn").onclick = async () => {
    const result = await postJson("/api/session/logout", {});
    if (isSessionExpiredResult(result)) {
      return;
    }
    window.location.replace("/");
  };

  for (const id of ["m_src", "m_title", "m_year", "s_src", "s_title", "s_season", "s_year"]) {
    const el = $(id);
    if (!el) continue;
    for (const eventName of ["input", "sl-input", "sl-change", "change"]) {
      el.addEventListener(eventName, syncRunButtons);
    }
  }

  document.addEventListener("click", (event) => {
    const mWrap = autocompleteAnchor("m_ac");
    const sWrap = autocompleteAnchor("s_ac");
    const mList = $("m_ac");
    const sList = $("s_ac");
    const mTargetInside = (mWrap && mWrap.contains(event.target)) || (mList && mList.contains(event.target));
    const sTargetInside = (sWrap && sWrap.contains(event.target)) || (sList && sList.contains(event.target));
    if (mWrap && !mTargetInside) {
      hideAutocomplete("m_ac");
    }
    if (sWrap && !sTargetInside) {
      hideAutocomplete("s_ac");
    }
  });

  window.addEventListener("resize", () => {
    repositionAutocomplete("m_ac");
    repositionAutocomplete("s_ac");
  });

  window.addEventListener("scroll", () => {
    repositionAutocomplete("m_ac");
    repositionAutocomplete("s_ac");
  }, true);

  onLocaleChange(() => {
    renderSaved();
    if (listedItems.length > 0) {
      renderBrowseList(listedRoot, listedItems);
    }
    if (sessionFailureState) {
      $("session_message").textContent = t(sessionFailureState.messageKey);
      $("session_hint").textContent = t(sessionFailureState.hintKey);
    }
    if (listErrorText) {
      log(listErrorText);
    }
  });

  ensureFloatingTooltipPortal();
  renderSaved();
  syncRunButtons();
  $("root").value = "torrents";

  function closeDeleteDialog() {
    pendingDeleteId = null;
    $("confirm_delete").hide();
  }

  async function confirmDeleteDialog() {
    if (pendingDeleteId) {
      await deleteSavedItem(pendingDeleteId);
    }
    pendingDeleteId = null;
    $("confirm_delete").hide();
  }

  for (const eventName of ["click", "sl-click"]) {
    $("cancel_delete").addEventListener(eventName, closeDeleteDialog);
    $("confirm_delete_btn").addEventListener(eventName, confirmDeleteDialog);
    $("session_reload").addEventListener(eventName, () => window.location.reload());
  }

  initSavedItems();
}

onReady(() => {
  initBackgroundEffect();
  initAppShell();
});
