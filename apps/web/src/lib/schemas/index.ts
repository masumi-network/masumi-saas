import { z } from "zod";
import { zfd } from "zod-form-data";

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const termsAcceptedMessage =
  "You must agree to the terms of service and privacy policy";

export const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  termsAccepted: z.boolean(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

// Accept FormData (strings) but emit the same boolean-typed shape
export const signUpFormDataSchema = zfd.formData(
  signUpSchema
    .extend({
      termsAccepted: zfd
        .checkbox({ trueValue: "true" })
        .refine((val) => val === true, {
          message: termsAcceptedMessage,
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
);

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    token: z.string().min(1, "Token is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

export const updateNameFormDataSchema = zfd.formData(updateNameSchema);
export const changePasswordFormDataSchema = zfd.formData(changePasswordSchema);
export const deleteAccountFormDataSchema = zfd.formData(deleteAccountSchema);
