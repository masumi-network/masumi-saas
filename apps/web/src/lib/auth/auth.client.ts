"use client";

import {
  adminClient,
  apiKeyClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [organizationClient(), apiKeyClient(), adminClient()],
});

export const {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  useSession,
  changeEmail,
} = authClient;
