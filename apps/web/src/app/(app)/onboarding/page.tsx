import { redirect } from "next/navigation";

/**
 * Legacy route - redirects to the dashboard.
 * Kept for backwards compatibility (bookmarks, old links).
 */
export default function OnboardingRedirect() {
  redirect("/");
}
