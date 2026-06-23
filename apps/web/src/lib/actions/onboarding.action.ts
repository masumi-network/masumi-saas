"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { markOnboardingCompleteForUser } from "@/lib/onboarding/mark-onboarding-complete";

export async function completeOnboardingAction(): Promise<
  | { success: true }
  | { success: false; errorKey: "FailedToComplete" | "UnexpectedError" }
> {
  try {
    const { user } = await getAuthenticatedOrThrow({
      requireEmailVerified: false,
    });

    const updated = await markOnboardingCompleteForUser(user.id);
    if (!updated) {
      return {
        success: false,
        errorKey: "FailedToComplete",
      };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[onboarding] Failed to complete onboarding:", error);
    return {
      success: false,
      errorKey: "UnexpectedError",
    };
  }
}
