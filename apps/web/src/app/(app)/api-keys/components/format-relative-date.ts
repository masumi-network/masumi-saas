/**
 * Format a date for display (e.g. "2 days ago" or absolute date if older).
 */
export function formatRelativeDate(date: Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "just now";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
