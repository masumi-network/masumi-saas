#!/usr/bin/env node

const SUPPRESSED_WARNING =
  "[baseline-browser-mapping] The data in this module is over two months old.";

const originalWarn = console.warn;
const path = require("node:path");

console.warn = (...args) => {
  const message = args.map(String).join(" ");

  if (message.includes(SUPPRESSED_WARNING)) {
    return;
  }

  originalWarn(...args);
};

const eslintBin = path.join(
  path.dirname(require.resolve("eslint")),
  "..",
  "bin",
  "eslint.js",
);

require(eslintBin);
