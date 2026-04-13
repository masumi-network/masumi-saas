const MAX_NAME_LENGTH = 80;

/**
 * Derives a human-readable display name from an email local part when the user
 * has not provided a name (e.g. magic link sign-in without signup form).
 */
export function displayNameFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0) {
    return "User";
  }

  let local = normalized.slice(0, at);
  const plus = local.indexOf("+");
  if (plus !== -1) {
    local = local.slice(0, plus);
  }

  local = local
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!local) {
    return "User";
  }

  const titled = local
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return titled.length > MAX_NAME_LENGTH
    ? titled.slice(0, MAX_NAME_LENGTH).trim()
    : titled;
}
