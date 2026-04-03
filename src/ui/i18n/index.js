import { messages } from "./messages.js";

const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = new Set(["en", "ru"]);
const STORAGE_KEY = "nas_linker_locale";
const LOCALE_CHANGE_EVENT = "nas-linker:localechange";

let currentLocale = DEFAULT_LOCALE;

function resolveMessage(locale, key) {
  return messages[locale]?.[key];
}

function normalizeLocale(locale) {
  const raw = String(locale || "").trim().toLowerCase();
  if (!raw) return DEFAULT_LOCALE;
  const base = raw.split(/[-_]/)[0];
  return SUPPORTED_LOCALES.has(base) ? base : DEFAULT_LOCALE;
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function getLocale() {
  return currentLocale;
}

export function t(key, vars) {
  const template =
    resolveMessage(currentLocale, key)
    ?? resolveMessage(DEFAULT_LOCALE, key)
    ?? key;
  return interpolate(template, vars);
}

export function detectInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeLocale(saved);
  } catch {
    // Ignore localStorage access failures and fall back to navigator/default.
  }
  return normalizeLocale(navigator.language);
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale);
  const changed = nextLocale !== currentLocale;
  currentLocale = nextLocale;
  try {
    localStorage.setItem(STORAGE_KEY, currentLocale);
  } catch {
    // Ignore persistence failures; locale still applies for this page load.
  }
  return changed;
}

export function initI18n() {
  currentLocale = detectInitialLocale();
  applyTranslations(document);
  initLocaleSwitchers(document);
}

export function applyTranslations(root = document) {
  document.documentElement.lang = currentLocale;

  const pageTitleKey = document.body?.dataset?.pageTitleKey;
  if (pageTitleKey) {
    document.title = t(pageTitleKey);
  }

  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of root.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  }
  for (const element of root.querySelectorAll("[data-i18n-label]")) {
    element.setAttribute("label", t(element.dataset.i18nLabel));
  }
  for (const element of root.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  for (const element of root.querySelectorAll("[data-i18n-alt]")) {
    element.setAttribute("alt", t(element.dataset.i18nAlt));
  }
}

function updateLocaleSwitcherState(root = document) {
  for (const button of root.querySelectorAll("[data-locale]")) {
    const isActive = button.dataset.locale === currentLocale;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
  }
}

function emitLocaleChange() {
  document.dispatchEvent(
    new CustomEvent(LOCALE_CHANGE_EVENT, {
      detail: { locale: currentLocale },
    }),
  );
}

export function initLocaleSwitchers(root = document) {
  for (const switcher of root.querySelectorAll("[data-locale-switcher]")) {
    if (switcher.dataset.localeBound === "true") continue;
    switcher.dataset.localeBound = "true";
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("[data-locale]");
      if (!button) return;
      const nextLocale = normalizeLocale(button.dataset.locale);
      if (nextLocale === currentLocale) return;
      setLocale(nextLocale);
      applyTranslations(document);
      updateLocaleSwitcherState(document);
      emitLocaleChange();
    });
  }
  updateLocaleSwitcherState(root);
}

export function onLocaleChange(listener) {
  document.addEventListener(LOCALE_CHANGE_EVENT, listener);
  return () => document.removeEventListener(LOCALE_CHANGE_EVENT, listener);
}
