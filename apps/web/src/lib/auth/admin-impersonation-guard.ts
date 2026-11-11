import "server-only";

import prisma from "@masumi/database/client";
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { isAdminUser } from "@/lib/auth/config";

const ADMIN_IMPERSONATION_TARGET_ERROR = "Admin users cannot be impersonated.";
const BANNED_IMPERSONATION_TARGET_ERROR =
  "Banned users cannot be impersonated.";

export const adminImpersonationGuardPlugin = {
  id: "admin-impersonation-guard",
  hooks: {
    before: [
      {
        matcher(context) {
          return context.path === "/admin/impersonate-user";
        },
        handler: createAuthMiddleware(async (ctx) => {
          const currentSession = await getSessionFromCtx(ctx);
          if (!currentSession?.user || !isAdminUser(currentSession.user)) {
            return;
          }

          const targetUserId =
            typeof ctx.body?.userId === "string"
              ? ctx.body.userId
              : ctx.body?.userId != null
                ? String(ctx.body.userId)
                : null;

          if (!targetUserId) {
            return;
          }

          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { banned: true, id: true, role: true },
          });

          if (!targetUser) {
            return;
          }

          if (targetUser.banned) {
            throw new APIError("FORBIDDEN", {
              message: BANNED_IMPERSONATION_TARGET_ERROR,
            });
          }

          if (!isAdminUser(targetUser)) {
            return;
          }

          throw new APIError("FORBIDDEN", {
            message: ADMIN_IMPERSONATION_TARGET_ERROR,
          });
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;
