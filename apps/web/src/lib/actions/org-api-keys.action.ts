"use server";

import type { ApiKeyListItem } from "./auth.action";
import { getApiKeysAction } from "./auth.action";

export type ApiKeysPageData = {
  scope: "personal";
  keys: ApiKeyListItem[];
};

export async function getApiKeysPageDataAction(): Promise<
  { success: true; data: ApiKeysPageData } | { success: false; error: string }
> {
  const result = await getApiKeysAction();
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return {
    success: true,
    data: { scope: "personal", keys: result.keys },
  };
}
