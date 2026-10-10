"use client";

import { useCallback, useState } from "react";

import { switchOrganizationWorkspace } from "@/lib/activate-organization-workspace";

type UseWorkspaceSwitcherOptions = {
  /** Called after Better Auth set-active succeeds (e.g. refresh org list). */
  onActivated?: () => void;
};

export function useWorkspaceSwitcher(options?: UseWorkspaceSwitcherOptions) {
  const [isActivating, setIsActivating] = useState(false);
  const onActivated = options?.onActivated;

  const handleSelectWorkspace = useCallback(
    async (organizationId: string | null): Promise<void> => {
      setIsActivating(true);
      try {
        await switchOrganizationWorkspace(organizationId);
        onActivated?.();
      } catch (error) {
        console.error("Failed to switch organization:", error);
        throw error;
      } finally {
        setIsActivating(false);
      }
    },
    [onActivated],
  );

  return {
    isActivating,
    handleSelectWorkspace,
  };
}
