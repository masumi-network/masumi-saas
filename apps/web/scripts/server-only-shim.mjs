// Stubs the `server-only` package when running scripts outside Next.js
// (e.g. swagger spec generation). The real package throws on import as a
// safeguard against client-side bundling; in a Node CLI context we just
// need it to no-op so we can import route modules.
import { register } from "node:module";

register("./server-only-resolver.mjs", import.meta.url);
