"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { zfd } from "zod-form-data";

import { auth } from "@/lib/auth/auth";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/schemas";

export async function signOutAction() {
  const headersList = await headers();
  await auth.api.signOut({
    headers: headersList,
  });
  redirect("/signin");
}

export async function signInAction(formData: FormData) {
  const validation = zfd.formData(signInSchema).safeParse(formData);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const result = await auth.api.signInEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
      },
    });

    if (!result.user) {
      return {
        error: "Invalid email or password",
      };
    }

    return {
      success: true,
    };
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
        };
      }
      if (
        errorMessage.includes("invalid") ||
        errorMessage.includes("password") ||
        errorMessage.includes("email") ||
        errorMessage.includes("credentials")
      ) {
        return {
          error: "Invalid email or password",
        };
      }
      return {
        error: error.message,
      };
    }
    return {
      error: "An unexpected error occurred",
    };
  }
}

export async function signUpAction(formData: FormData) {
  const validation = zfd.formData(signUpSchema).safeParse(formData);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: validation.data.email,
        password: validation.data.password,
        name: validation.data.name,
      },
    });

    if (!result.user) {
      return {
        error: "Failed to create account",
      };
    }

    return {
      success: true,
    };
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
        };
      }
      if (
        errorMessage.includes("unique") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("already exists")
      ) {
        return {
          error: "An account with this email already exists",
        };
      }
      return {
        error: error.message,
      };
    }
    return {
      error: "An unexpected error occurred",
    };
  }
}

export async function forgotPasswordAction(formData: FormData) {
  const validation = zfd.formData(forgotPasswordSchema).safeParse(formData);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const headersList = await headers();
    await auth.api.forgotPassword({
      headers: headersList,
      body: {
        email: validation.data.email,
        redirectTo: "/reset-password",
      },
    });

    return {
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
    };
  } catch (error) {
    return {
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
    };
  }
}
