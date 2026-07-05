import "server-only";

import prisma from "@masumi/database/client";

/**
 * Persists onboardingCompleted in Prisma only.
 * Avoids Better Auth updateUser so we do not re-run signup side effects
 * (e.g. grantInitialCreditsIfNeeded) on every onboarding completion.
 */
export async function markOnboardingCompleteForUser(
  userId: string,
): Promise<boolean> {
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
