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

export type AdminCheckUser = {
  id: string;
  role?: string | null;
};

/**
 * Centralized admin check. A user is admin if:
 * 1. Their DB role field is "admin", OR
 * 2. Their user ID is in the ADMIN_USER_IDS env var (bootstrap mechanism)
 */
export function isAdminUser(user: AdminCheckUser): boolean {
  return user.role === "admin" || getBootstrapAdminIds().includes(user.id);
}
