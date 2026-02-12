/**
 * Shared auth configuration utilities
 */

/**
 * Parse ADMIN_USER_IDS environment variable into array of user IDs.
 * This ensures consistent parsing across the codebase.
 *
 * @returns Array of admin user IDs from environment variable
 */
export function getBootstrapAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
