import "server-only";

import { createRequire } from "node:module";

/**
 * signify-ts depends on libsodium-wrappers-sumo ESM, which imports a sibling
 * `./libsodium-sumo.mjs` that is not shipped in that folder (broken in 0.7.x).
 * The CJS entry resolves correctly — load that on the server only.
 */
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const signifyTs = require("signify-ts") as typeof import("signify-ts");

export const SignifyClient = signifyTs.SignifyClient;
export const signifyReady = signifyTs.ready;
export const Tier = signifyTs.Tier;
