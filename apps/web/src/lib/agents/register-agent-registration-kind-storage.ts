const STORAGE_KEY = "masumi_register_agent_registration_kind";

export type StoredRegistrationKind = "STANDARD" | "X402_HTTP";

export function readStoredRegistrationKind(): StoredRegistrationKind {
  if (typeof window === "undefined") return "STANDARD";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "STANDARD" || value === "X402_HTTP") return value;
  } catch {
    // ignore quota / private mode
  }
  return "STANDARD";
}

export function persistRegistrationKind(kind: StoredRegistrationKind): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    // ignore
  }
}
