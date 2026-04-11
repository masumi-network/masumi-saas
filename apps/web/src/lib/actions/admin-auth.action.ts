"use server";

import prisma from "@masumi/database/client";

import { auth } from "@/lib/auth/auth";
import { classifyAuthError } from "@/lib/auth/error-results";
import { isAdminUser } from "@/lib/auth/utils";
import { signInFormDataSchema } from "@/lib/schemas";

export async function adminSignInAction(formData: FormData) {
  const validation = signInFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  // SECURITY FIX: Always attempt sign-in first to avoid timing oracle attack
  // This ensures password hashing happens regardless of admin status
  try {
    const result = await auth.api.signInEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
      },
    });

    // Sign-in failed (wrong credentials)
    if (!result.user) {
      return {
        error: "Invalid email or password",
        errorKey: "InvalidCredentials",
      };
    }

    // Sign-in succeeded - now check if user is admin
    if (!isAdminUser(result.user)) {
      // User authenticated but not admin - revoke the session we just created
      // Don't pass explicit headers so nextCookies() can read the freshly set session cookie
      try {
        await auth.api.signOut();
      } catch {
        // If signOut fails, manually clear the session cookie to prevent session leak
        // If signOut fails, delete the session directly from the database
        // This is more robust than just clearing the cookie, as it ensures
        // the session record is also removed from the database
        if (result.token) {
          try {
            await prisma.session.deleteMany({
              where: { token: result.token },
            });
          } catch {
            // Session cleanup failed - log but don't expose to client
            console.error(
              "Failed to clean up session for non-admin user during admin sign-in",
            );
          }
        }
      }
      // Return same generic error to prevent admin enumeration
      return {
        error: "Invalid email or password",
        errorKey: "InvalidCredentials",
      };
    }

    // User is authenticated AND admin - success
    return { success: true, resultKey: "AdminSignInSuccess" };
  } catch (error) {
    return classifyAuthError(error, [
      {
        matches: (message) =>
          message.includes("invalid") ||
          message.includes("password") ||
          message.includes("email") ||
          message.includes("credentials") ||
          message.includes("banned"),
        result: {
          error: "Invalid email or password",
          errorKey: "InvalidCredentials" as const,
        },
      },
    ]);
  }
}
