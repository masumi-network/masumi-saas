/**
 * Formats a name by taking the first word and adding the first letter of the last word with a period.
 * Examples:
 * - "Isaac Adebayo" -> "Isaac A."
 * - "Isaac Markus Smith" -> "Isaac S." (first and last)
 * - "John Doe" -> "John D."
 * - "SingleName" -> "SingleName"
 * - "" -> ""
 */
export function formatName(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return "";
  }

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0]!;
  }

  const firstName = words[0]!;
  const lastWord = words[words.length - 1]?.trim();

  if (!lastWord || lastWord.length === 0) {
    return firstName;
  }

  const lastNameFirstLetter = lastWord[0]?.toUpperCase() ?? "";

  if (!lastNameFirstLetter) {
    return firstName;
  }

  return `${firstName} ${lastNameFirstLetter}.`;
}

/**
 * Gets initials from a name.
 * Examples:
 * - "Isaac Adebayo" -> "IA"
 * - "Isaac Markus Smith" -> "IS" (first and last)
 * - "John Doe" -> "JD"
 * - "SingleName" -> "S"
 * - "" -> "U"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return "U";
  }

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0]![0]?.toUpperCase() ?? "U";
  }

  const firstWord = words[0]?.trim();
  const lastWord = words[words.length - 1]?.trim();

  const firstInitial = firstWord?.[0]?.toUpperCase() ?? "U";
  const lastInitial = lastWord?.[0]?.toUpperCase() ?? "";

  return lastInitial ? `${firstInitial}${lastInitial}` : firstInitial;
}
