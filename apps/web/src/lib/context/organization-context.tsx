"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getOrganizationsAction,
  type OrganizationInfo,
} from "@/lib/actions/organization.action";
import { switchOrganizationWorkspace } from "@/lib/activate-organization-workspace";
import { authClient } from "@/lib/auth/auth.client";
import type { SessionWithOrganization } from "@/lib/auth/session-types";

export type { OrganizationInfo };

export type OrganizationContextValue = {
  /** Currently active organization (from session) */
  activeOrganization: OrganizationInfo | null;
  /** Active organization ID from session (available before orgs load) */
  activeOrganizationId: string | null;
  /** All organizations the user is a member of */
  organizations: OrganizationInfo[];
  /** Whether org data is loading */
  isLoading: boolean;
  /** Switch to a different organization */
  setActiveOrganization: (organizationId: string | null) => Promise<void>;
  /** Refetch organizations and active org */
  refetch: () => void;
  /** After org create (Better Auth already set active org in DB). */
  syncAfterOrganizationCreate: () => Promise<void>;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null,
);

export function useOrganizationContext(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error(
      "useOrganizationContext must be used within OrganizationProvider",
    );
  }
  return ctx;
}

export function useOrganizationContextOptional(): OrganizationContextValue | null {
  return useContext(OrganizationContext);
}

interface OrganizationProviderProps {
  children: React.ReactNode;
}

/**
 * Provides organization context to the app. Fetches organizations via server
 * action and uses Better Auth session for activeOrganizationId.
 * Must be used within an authenticated app layout.
 */
export function OrganizationProvider({ children }: OrganizationProviderProps) {
  const {
    data: session,
    isPending: sessionPending,
    isRefetching: sessionRefetching,
  } = authClient.useSession();
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  const activeOrganizationId =
    (session as SessionWithOrganization)?.session?.activeOrganizationId ?? null;

  const activeOrganization = useMemo(() => {
    if (!activeOrganizationId) return null;
    return organizations.find((o) => o.id === activeOrganizationId) ?? null;
  }, [activeOrganizationId, organizations]);

  const fetchOrganizations = useCallback(async () => {
    const result = await getOrganizationsAction();
    if (result.success) {
      setOrganizations(result.data);
    } else {
      console.warn("[OrganizationProvider] Failed to load organizations", {
        error: result.error,
      });
    }
    setOrgsLoading(false);
  }, []);

  useEffect(() => {
    if (sessionPending || sessionRefetching) {
      return;
    }
    if (!session?.user?.id) {
      queueMicrotask(() => {
        setOrganizations([]);
        setOrgsLoading(false);
      });
      return;
    }
    queueMicrotask(() => setOrgsLoading(true));
    const id = setTimeout(() => void fetchOrganizations(), 0);
    return () => clearTimeout(id);
  }, [
    session?.user?.id,
    sessionPending,
    sessionRefetching,
    fetchOrganizations,
  ]);

  const setActiveOrganization = useCallback(
    async (organizationId: string | null) => {
      try {
        await switchOrganizationWorkspace(organizationId);
        void fetchOrganizations();
      } catch (error) {
        console.error("Failed to set active organization:", error);
      }
    },
    [fetchOrganizations],
  );

  const syncAfterOrganizationCreate = useCallback(async () => {
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const refetch = useCallback(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      activeOrganization,
      activeOrganizationId,
      organizations,
      isLoading: sessionPending || orgsLoading,
      setActiveOrganization,
      refetch,
      syncAfterOrganizationCreate,
    }),
    [
      activeOrganization,
      activeOrganizationId,
      organizations,
      sessionPending,
      orgsLoading,
      setActiveOrganization,
      refetch,
      syncAfterOrganizationCreate,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
