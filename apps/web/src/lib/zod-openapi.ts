/**
 * Shared Zod instance extended for `@asteasolutions/zod-to-openapi` (`.openapi()`).
 * Use from app schemas and from `lib/swagger/*` so domain code does not import `swagger/`.
 */

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };
