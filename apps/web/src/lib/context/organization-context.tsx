"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getOrganizationsAction } from "@/lib/actions/organization.action";
import { authClient } from "@/lib/auth/auth.client";

export type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  role?: string;
};

export type OrganizationContextValue = {
  /** Currently active organization (from session) */
  activeOrganization: OrganizationInfo | null;
  /** All organizations the user is a member of */
  organizations: OrganizationInfo[];
  /** Whether org data is loading */
  isLoading: boolean;
  /** Switch to a different organization */
  setActiveOrganization: (organizationId: string | null) => Promise<void>;
  /** Refetch organizations and active org */
  refetch: () => void;
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
  const router = useRouter();
  const {
    data: session,
    isPending: sessionPending,
    refetch: refetchSession,
  } = authClient.useSession();
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);

  const activeOrganizationId =
    (
      session as {
        session?: { activeOrganizationId?: string | null };
      }
    )?.session?.activeOrganizationId ?? null;

  const activeOrganization = useMemo(() => {
    if (!activeOrganizationId) return null;
    return organizations.find((o) => o.id === activeOrganizationId) ?? null;
  }, [activeOrganizationId, organizations]);

  const fetchOrganizations = useCallback(async () => {
    const result = await getOrganizationsAction();
    if (result.success) {
      setOrganizations(result.data);
    } else {
      setOrganizations([]);
    }
    setOrgsLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      queueMicrotask(() => {
        setOrganizations([]);
        setOrgsLoading(false);
      });
      return;
    }
    queueMicrotask(() => setOrgsLoading(true));
    const id = setTimeout(() => void fetchOrganizations(), 0);
    return () => clearTimeout(id);
  }, [session?.user?.id, session?.user, fetchOrganizations]);

  const setActiveOrganization = useCallback(
    async (organizationId: string | null) => {
      const { error } = await authClient.organization.setActive({
        organizationId,
      });
      if (error) {
        console.error("Failed to set active organization:", error);
        return;
      }
      await refetchSession();
      router.refresh();
    },
    [router, refetchSession],
  );

  const refetch = useCallback(() => {
    void fetchOrganizations();
    router.refresh();
  }, [fetchOrganizations, router]);

  const value = useMemo<OrganizationContextValue>(
    () => ({
      activeOrganization,
      organizations,
      isLoading: sessionPending || orgsLoading,
      setActiveOrganization,
      refetch,
    }),
    [
      activeOrganization,
      organizations,
      sessionPending,
      orgsLoading,
      setActiveOrganization,
      refetch,
    ],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}
