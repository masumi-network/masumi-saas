import type { CorsOptions } from "@/lib/api/cors";

/** Public network registration API — marketing site sends credentialed requests after OTP verify. */
export const NETWORK_REGISTER_CORS_OPTIONS = {
  allowCredentials: true,
} as const satisfies CorsOptions;
