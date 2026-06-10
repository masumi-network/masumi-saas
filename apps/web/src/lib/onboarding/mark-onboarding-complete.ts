import "server-only";

import prisma from "@masumi/database/client";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

/** Persists onboardingCompleted via Better Auth, with Prisma fallback on failure. */
export async function markOnboardingCompleteForUser(
  userId: string,
  requestHeaders?: Headers,
): Promise<boolean> {
  const headersList = requestHeaders ?? (await headers());

  try {
    await auth.api.updateUser({
      headers: headersList,
      body: { onboardingCompleted: true },
    });
    return true;
  } catch (error) {
    console.error(
      "[onboarding] Failed to mark complete via Better Auth; falling back to Prisma",
      userId,
      error,
    );
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
    return true;
  } catch (error) {
    console.error(
      "[onboarding] Failed to mark complete via Prisma",
      userId,
      error,
    );
    return false;
  }
}
