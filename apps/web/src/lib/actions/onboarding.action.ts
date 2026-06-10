"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/auth";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";

export async function completeOnboardingAction(): Promise<
  | { success: true }
  | { success: false; errorKey: "FailedToComplete" | "UnexpectedError" }
> {
  const { headers: headersList } = await getAuthenticatedOrThrow();

  try {
    await auth.api.updateUser({
      headers: headersList,
      body: { onboardingCompleted: true },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("[onboarding] Failed to complete onboarding:", error);
    return {
      success: false,
      errorKey: "FailedToComplete",
    };
  }
}
