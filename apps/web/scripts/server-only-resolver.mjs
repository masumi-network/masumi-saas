// Module resolver hook that swaps `server-only` for an empty no-op so CLI
// scripts (swagger spec generation) can import route modules without
// tripping the real package's "client component" guard.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: new URL("./server-only-noop.mjs", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
