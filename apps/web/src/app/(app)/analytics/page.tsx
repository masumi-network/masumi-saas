import { redirect } from "next/navigation";

/**
 * Analytics has been replaced by Activity.
 * Redirect so old links and bookmarks still work.
 */
export default function AnalyticsPage() {
  redirect("/activity");
}
