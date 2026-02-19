import { redirect } from "next/navigation";

/**
 * Legacy route - redirects to /verification.
 * Kept for backwards compatibility (bookmarks, old links).
 */
export default function OnboardingRedirect() {
  redirect("/verification");
}
