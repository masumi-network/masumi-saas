"use server";

import { redirect } from "next/navigation";
import { zfd } from "zod-form-data";

import { auth } from "@/lib/auth/auth";
import { getAuthenticatedHeaders, getRequestHeaders } from "@/lib/auth/utils";
import {
  changePasswordFormDataSchema,
  deleteAccountFormDataSchema,
  signInSchema,
  signUpFormDataSchema,
  updateNameFormDataSchema,
} from "@/lib/schemas";

import { convertZodError } from "../utils/convert-zod-error";

export async function signOutAction() {
  const headersList = await getRequestHeaders();
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
      errorKey: "InvalidInput",
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
        errorKey: "InvalidCredentials",
      };
    }

    return {
      success: true,
      resultKey: "SignInSuccess",
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
          errorKey: "DatabaseError",
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
          errorKey: "InvalidCredentials",
        };
      }
      return {
        error: error.message,
        errorKey: "UnexpectedError",
      };
    }
    return {
      error: "An unexpected error occurred",
      errorKey: "UnexpectedError",
    };
  }
}

export async function signUpAction(formData: FormData) {
  const validation = signUpFormDataSchema.safeParse(formData);
  if (!validation.success) {
    return {
      error: convertZodError(validation.error),
      errorKey: "InvalidInput",
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
        errorKey: "AccountCreationFailed",
      };
    }

    return {
      success: true,
      resultKey: "SignUpSuccess",
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
          errorKey: "DatabaseError",
        };
      }
      if (
        errorMessage.includes("unique") ||
        errorMessage.includes("duplicate") ||
        errorMessage.includes("already exists")
      ) {
        return {
          error: "An account with this email already exists",
          errorKey: "AccountExists",
        };
      }
      return {
        error: error.message,
        errorKey: "UnexpectedError",
      };
    }
    return {
      error: "An unexpected error occurred",
      errorKey: "UnexpectedError",
    };
  }
}

export async function updateUserNameAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedHeaders();
  const validation = updateNameFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.updateUser({
      headers: headersList,
      body: {
        name: validation.data.name.trim(),
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update name",
      errorKey: "UnexpectedError",
    };
  }
}

export async function changePasswordAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedHeaders();
  const validation = changePasswordFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.changePassword({
      headers: headersList,
      body: {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to change password",
      errorKey: "UnexpectedError",
    };
  }
}

export async function deleteAccountAction(formData: FormData) {
  const { headers: headersList } = await getAuthenticatedHeaders();
  const validation = deleteAccountFormDataSchema.safeParse(formData);

  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message || "Invalid input",
      errorKey: "InvalidInput",
    };
  }

  try {
    await auth.api.deleteUser({
      headers: headersList,
      body: {
        password: validation.data.currentPassword,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete account",
      errorKey: "UnexpectedError",
    };
  }
}
