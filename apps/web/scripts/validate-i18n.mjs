#!/usr/bin/env node
// @ts-check
/**
 * Translation catalog validator.
 *
 * Verifies:
 *  - All locale files have the same key structure as the source (en.json).
 *  - Every ICU placeholder ({name}, {count}, ...) present in en exists in
 *    every locale string and vice versa.
 *  - Every HTML-like tag (<link>, </link>) present in en exists in every
 *    locale string and vice versa.
 *  - No positional-placeholder artifacts remain (`«N›`, `«N»`, `<N>`,
 *    `「N」`, `——N›`) — these are corruption from some translation tools
 *    that drop the ICU named placeholders.
 *
 * Exits 1 with a human-readable report on the first failing locale.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");
const SOURCE_LOCALE = "en";

const POSITIONAL_PATTERNS = [/«\d+›/, /«\d+»/, /<\d+>/, /「\d+」/, /——\d+›/];

/** @param {Record<string, unknown>} obj @param {string} [prefix] @returns {Record<string, string>} */
function flatten(obj, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(
        out,
        flatten(/** @type {Record<string, unknown>} */ (v), key),
      );
    } else if (typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

/** @param {string} s */
function placeholders(s) {
  return (s.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || []).sort();
}

/** @param {string} s */
function tags(s) {
  return (s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*>/g) || []).sort();
}

/** @param {string} s */
function hasPositionalArtifact(s) {
  return POSITIONAL_PATTERNS.some((re) => re.test(s));
}

function listLocales() {
  return fs
    .readdirSync(MESSAGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/** @param {string} locale */
function loadLocale(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"),
  );
}

function main() {
  const locales = listLocales();
  if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`[i18n] source locale ${SOURCE_LOCALE}.json not found`);
    process.exit(1);
  }

  const sourceFlat = flatten(loadLocale(SOURCE_LOCALE));
  const sourceKeys = new Set(Object.keys(sourceFlat));

  const errors = [];

  for (const locale of locales) {
    if (locale === SOURCE_LOCALE) continue;
    const flat = flatten(loadLocale(locale));
    const keys = new Set(Object.keys(flat));

    const missing = [...sourceKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !sourceKeys.has(k));
    if (missing.length) {
      errors.push(
        `[${locale}] missing ${missing.length} key(s):\n  ` +
          missing.slice(0, 25).join("\n  ") +
          (missing.length > 25
            ? `\n  ... and ${missing.length - 25} more`
            : ""),
      );
    }
    if (extra.length) {
      errors.push(
        `[${locale}] extra ${extra.length} key(s) not in ${SOURCE_LOCALE}:\n  ` +
          extra.slice(0, 25).join("\n  ") +
          (extra.length > 25 ? `\n  ... and ${extra.length - 25} more` : ""),
      );
    }

    for (const key of sourceKeys) {
      const enVal = sourceFlat[key];
      const lVal = flat[key];
      if (typeof lVal !== "string") continue;

      // ICU placeholder parity.
      const enPh = placeholders(enVal);
      const lPh = placeholders(lVal);
      if (JSON.stringify(enPh) !== JSON.stringify(lPh)) {
        errors.push(
          `[${locale}] placeholder mismatch at "${key}"\n  en:     ${JSON.stringify(enPh)}\n  ${locale}: ${JSON.stringify(lPh)}\n  ${locale} value: ${JSON.stringify(lVal)}`,
        );
      }

      // HTML tag parity.
      const enTags = tags(enVal);
      const lTags = tags(lVal);
      if (JSON.stringify(enTags) !== JSON.stringify(lTags)) {
        errors.push(
          `[${locale}] tag mismatch at "${key}"\n  en:     ${JSON.stringify(enTags)}\n  ${locale}: ${JSON.stringify(lTags)}`,
        );
      }

      // Positional artifact detection.
      if (hasPositionalArtifact(lVal)) {
        errors.push(
          `[${locale}] positional placeholder artifact at "${key}"\n  value: ${JSON.stringify(lVal)}\n  expected named ICU placeholders like {name}, not «0›/<0>/「0」`,
        );
      }
    }
  }

  if (errors.length) {
    console.error("\n[i18n] validation failed:\n");
    for (const e of errors) {
      console.error(e);
      console.error("");
    }
    console.error(
      `Total: ${errors.length} issue(s) across ${locales.length} locales.`,
    );
    process.exit(1);
  }

  console.log(
    `[i18n] OK: ${locales.length} locales (${[...sourceKeys].length} keys) - structural, placeholder, tag, and artifact checks passed.`,
  );
}

main();
