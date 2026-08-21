import en from './en.js';
import zh from './zh.js';
import { getLang, setLang as persistLang } from '../utils/storage.js';

// Every string the player can read goes through `t()`. Scenes never hold a
// literal, so adding a language means adding one file here — not hunting
// through 30-odd `add.text` calls.

const TABLES = { en, zh };
export const LANGUAGES = ['en', 'zh'];
const FALLBACK = 'en';

let current = null;

function resolveInitialLang() {
  const stored = getLang();
  if (stored && TABLES[stored]) return stored;
  // No choice made yet: follow the browser, since the game ships both.
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '') : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : FALLBACK;
}

export function getCurrentLang() {
  if (current === null) current = resolveInitialLang();
  return current;
}

export function setLanguage(lang) {
  if (!TABLES[lang]) return;
  current = lang;
  persistLang(lang);
}

// Cycles through the available languages — the settings row has one button for
// this, not a list.
export function nextLanguage() {
  const i = LANGUAGES.indexOf(getCurrentLang());
  return LANGUAGES[(i + 1) % LANGUAGES.length];
}

export function languageLabel(lang = getCurrentLang()) {
  return (TABLES[lang] || TABLES[FALLBACK]).langName;
}

/**
 * Looks up `key` in the active language and substitutes `{placeholders}`.
 * An unknown key falls back to English, then to the key itself, so a missing
 * translation shows up as a visible label rather than as `undefined`.
 */
export function t(key, params) {
  const table = TABLES[getCurrentLang()] || TABLES[FALLBACK];
  let text = table[key];
  if (text === undefined) text = TABLES[FALLBACK][key];
  if (text === undefined) return key;
  if (!params) return text;

  return text.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}
