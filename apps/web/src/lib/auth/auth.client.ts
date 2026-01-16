"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [],
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
