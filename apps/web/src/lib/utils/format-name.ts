/**
 * Formats a name by taking the first word and adding the first letter of the second word with a period.
 * Examples:
 * - "Isaac Adebayo" -> "Isaac A."
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
  const secondNameFirstLetter = words[1]![0]?.toUpperCase() ?? "";

  return `${firstName} ${secondNameFirstLetter}.`;
}
