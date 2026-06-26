#!/usr/bin/env node
// @ts-check
/**
 * Merges scripts/x402-i18n/{locale}.json into messages/{locale}.json under App.X402.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const MESSAGES_DIR = path.join(WEB_ROOT, "messages");
const X402_I18N_DIR = path.join(WEB_ROOT, "scripts", "x402-i18n");
const LOCALES = ["ja", "de", "es", "fr"];

for (const locale of LOCALES) {
  const messagesPath = path.join(MESSAGES_DIR, `${locale}.json`);
  const x402Path = path.join(X402_I18N_DIR, `${locale}.json`);

  if (!fs.existsSync(messagesPath)) {
    console.error(`[x402-i18n] messages file not found: ${messagesPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(x402Path)) {
    console.error(`[x402-i18n] translation file not found: ${x402Path}`);
    process.exit(1);
  }

  const messages = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
  const x402 = JSON.parse(fs.readFileSync(x402Path, "utf8"));

  if (!messages.App) {
    console.error(`[x402-i18n] ${locale}: missing App namespace`);
    process.exit(1);
  }

  messages.App.X402 = x402;

  fs.writeFileSync(
    messagesPath,
    `${JSON.stringify(messages, null, 2)}\n`,
    "utf8",
  );
  console.log(`[x402-i18n] updated App.X402 in ${locale}.json`);
}

console.log(`[x402-i18n] done: ${LOCALES.length} locales updated`);
