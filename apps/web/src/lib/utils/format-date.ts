export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1_000);
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffSecs < 30) return "just now";
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffMins < 60)
    return diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
  if (diffHours < 24)
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  if (diffDays < 7)
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
