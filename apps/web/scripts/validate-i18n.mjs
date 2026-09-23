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
 *  - No duplicate keys within the same JSON object (JSON.parse silently
 *    keeps the last value, so duplicates are easy to miss in review).
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

/**
 * Scan raw JSON text for duplicate keys in the same object (JSON.parse drops
 * earlier duplicates silently).
 *
 * @param {string} text
 * @param {string} locale
 * @returns {string[]}
 */
function findDuplicateKeys(text, locale) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, number>[]} */
  const keyStack = [new Map()];
  /** @type {string[]} */
  const pathStack = [""];

  let index = 0;
  let line = 1;

  const errorAt = (message) => {
    errors.push(`[${locale}] ${message} (line ${line})`);
  };

  const advanceLine = (char) => {
    if (char === "\n") line += 1;
  };

  const peek = () => text[index] ?? "";

  const skipWhitespace = () => {
    while (index < text.length) {
      const char = text[index];
      if (char === " " || char === "\t" || char === "\r" || char === "\n") {
        advanceLine(char);
        index += 1;
        continue;
      }
      break;
    }
  };

  const readString = () => {
    const startLine = line;
    index += 1; // opening quote
    /** @type {string[]} */
    const chars = [];
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") {
        chars.push(char, text[index + 1] ?? "");
        index += 2;
        continue;
      }
      if (char === '"') {
        index += 1;
        return { value: chars.join(""), line: startLine };
      }
      advanceLine(char);
      chars.push(char);
      index += 1;
    }
    errorAt("unterminated JSON string");
    return { value: "", line: startLine };
  };

  const skipPrimitive = () => {
    while (index < text.length) {
      const char = text[index];
      if (char === "," || char === "}" || char === "]") break;
      advanceLine(char);
      index += 1;
    }
  };

  const skipArray = () => {
    index += 1; // [
    while (index < text.length) {
      skipWhitespace();
      if (peek() === "]") {
        index += 1;
        return;
      }
      parseValue();
      skipWhitespace();
      if (peek() === ",") index += 1;
    }
  };

  const parseObject = (parentPath) => {
    index += 1; // {
    const keys = new Map();
    keyStack.push(keys);
    pathStack.push(parentPath);

    while (index < text.length) {
      skipWhitespace();
      if (peek() === "}") {
        index += 1;
        keyStack.pop();
        pathStack.pop();
        return;
      }

      if (peek() !== '"') {
        errorAt(`expected object key string at "${parentPath || "(root)"}"`);
        skipPrimitive();
        continue;
      }

      const { value: key, line: keyLine } = readString();
      const fullPath = parentPath ? `${parentPath}.${key}` : key;
      if (keys.has(key)) {
        errors.push(
          `[${locale}] duplicate key "${key}" in object "${parentPath || "(root)"}" ` +
            `(first at line ${keys.get(key)}, again at line ${keyLine})`,
        );
      } else {
        keys.set(key, keyLine);
      }

      skipWhitespace();
      if (peek() === ":") index += 1;
      skipWhitespace();
      parseValue(fullPath);
      skipWhitespace();
      if (peek() === ",") index += 1;
    }

    keyStack.pop();
    pathStack.pop();
  };

  const parseValue = (path = "") => {
    skipWhitespace();
    const char = peek();
    if (char === "{") {
      parseObject(path);
      return;
    }
    if (char === "[") {
      skipArray();
      return;
    }
    if (char === '"') {
      readString();
      return;
    }
    skipPrimitive();
  };

  skipWhitespace();
  if (peek() === "{") {
    parseObject("");
  }

  return errors;
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

  const errors = [];

  for (const locale of locales) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    const raw = fs.readFileSync(filePath, "utf8");
    errors.push(...findDuplicateKeys(raw, locale));
  }

  const sourceFlat = flatten(loadLocale(SOURCE_LOCALE));
  const sourceKeys = new Set(Object.keys(sourceFlat));

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
    `[i18n] OK: ${locales.length} locales (${[...sourceKeys].length} keys) - duplicate-key, structural, placeholder, tag, and artifact checks passed.`,
  );
}

main();
