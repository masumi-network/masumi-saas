import "server-only";

import prisma from "@masumi/database/client";

import { markOnboardingCompleteForUser } from "@/lib/onboarding/mark-onboarding-complete";

/**
 * Whether the first-time onboarding dialog should open for this user.
 * Org invitees are auto-marked complete (they join an existing workspace).
 */
export async function resolveShowOnboarding(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleted: true,
      _count: { select: { members: true } },
    },
  });

  if (!user) {
    return false;
  }

  if (user.onboardingCompleted) {
    return false;
  }

  if (user._count.members > 0) {
    await markOnboardingCompleteForUser(userId);
    return false;
  }

  return true;
}
