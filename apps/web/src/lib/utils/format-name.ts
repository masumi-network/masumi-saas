/**
 * Formats a name by taking the first word and adding the first letter of the second word with a period.
 * Examples:
 * - "Isaac Adebayo" -> "Isaac A."
 * - "John Doe" -> "John D."
 * - "SingleName" -> "SingleName"
 * - "John " -> "John" (handles empty second word)
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
  const secondWord = words[1]?.trim();

  if (!secondWord || secondWord.length === 0) {
    return firstName;
  }

  const secondNameFirstLetter = secondWord[0]?.toUpperCase() ?? "";

  if (!secondNameFirstLetter) {
    return firstName;
  }

  return `${firstName} ${secondNameFirstLetter}.`;
}

/**
 * Gets initials from a name.
 * Examples:
 * - "Isaac Adebayo" -> "IA"
 * - "John Doe" -> "JD"
 * - "SingleName" -> "S"
 * - "John " -> "J" (handles empty second word)
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
  const secondWord = words[1]?.trim();

  const firstInitial = firstWord?.[0]?.toUpperCase() ?? "U";
  const secondInitial = secondWord?.[0]?.toUpperCase() ?? "";

  return secondInitial ? `${firstInitial}${secondInitial}` : firstInitial;
}
