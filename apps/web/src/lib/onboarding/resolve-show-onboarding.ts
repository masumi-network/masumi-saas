import "server-only";

import prisma from "@masumi/database/client";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

async function markOnboardingCompleteForUser(userId: string): Promise<void> {
  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { onboardingCompleted: true },
    });
    return;
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
  } catch (error) {
    console.error(
      "[onboarding] Failed to mark complete via Prisma",
      userId,
      error,
    );
  }
}

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
