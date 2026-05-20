// CJS preload that prepares a Node environment for running route modules
// outside of Next.js (e.g. swagger spec generation):
//  * stubs the `server-only` package (real one throws on import)
//  * provides a placeholder DATABASE_URL so Prisma client init doesn't
//    blow up — no DB queries actually run during spec generation
const Module = require("node:module");

const noopPath = require.resolve("./server-only-noop.cjs");
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, parent, ...rest) {
  if (request === "server-only") return noopPath;
  return originalResolve.call(this, request, parent, ...rest);
};

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgres://spec-gen:spec-gen@localhost:5432/spec-gen";
}
