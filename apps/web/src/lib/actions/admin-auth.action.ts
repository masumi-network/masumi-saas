"use server";

import { cookies } from "next/headers";
import { zfd } from "zod-form-data";

import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/auth/utils";
import { signInSchema } from "@/lib/schemas";

export async function adminSignInAction(formData: FormData) {
  const validation = zfd.formData(signInSchema).safeParse(formData);
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
        const cookieStore = await cookies();
        cookieStore.delete("better-auth.session_token");
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
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("denied access") ||
        errorMessage.includes("database") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("not available")
      ) {
        return {
          error:
            "Database connection error. Please check your database configuration.",
          errorKey: "DatabaseError",
        };
      }
      if (
        errorMessage.includes("invalid") ||
        errorMessage.includes("password") ||
        errorMessage.includes("email") ||
        errorMessage.includes("credentials") ||
        errorMessage.includes("banned")
      ) {
        return {
          error: "Invalid email or password",
          errorKey: "InvalidCredentials",
        };
      }
      // M3 FIX: Don't leak raw error.message to client
      return {
        error: "An unexpected error occurred",
        errorKey: "UnexpectedError",
      };
    }
    return {
      error: "An unexpected error occurred",
      errorKey: "UnexpectedError",
    };
  }
}
