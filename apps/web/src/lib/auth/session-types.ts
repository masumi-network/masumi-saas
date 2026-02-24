/**
 * Session shape from Better Auth organization plugin.
 * Use this type when reading activeOrganizationId from session
 * (server or client) so the type is defined in one place.
 */
export type SessionWithOrganization = {
  session?: { activeOrganizationId?: string | null };
};
