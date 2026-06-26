import { registerX402Routes } from "@/lib/x402/register-routes";
import { createApiApp } from "@/server/hono/app";
import { nextHandlers } from "@/server/hono/next";

export const routeMeta = { documents: ["platform"] as const };

const app = createApiApp("/api/v1/x402");
registerX402Routes(app);

export const { GET, POST, PATCH, DELETE, OPTIONS } = nextHandlers(app);
export default app;
