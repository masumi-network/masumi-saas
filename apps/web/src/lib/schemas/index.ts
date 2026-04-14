import { zfd } from "zod-form-data";

import { z } from "@/lib/zod-openapi";

const emailSchema = z.string().email("Please enter a valid email address");
const nameSchema = z.string().min(1, "Name is required");
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");
const confirmPasswordSchema = z.string().min(1, "Please confirm your password");

const termsAcceptedMessage =
  "You must agree to the terms of service and privacy policy";
const acceptedTermsSchema = z.boolean().refine((value) => value === true, {
  message: termsAcceptedMessage,
});
const acceptedTermsFormField = zfd
  .checkbox({ trueValue: "true" })
  .refine((val) => val === true, {
    message: termsAcceptedMessage,
  });
const baseSignUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

function withMatchingPasswords<
  TSchema extends z.ZodType<{
    password: string;
    confirmPassword: string;
  }>,
>(schema: TSchema) {
  return schema.refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
}

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const signInFormDataSchema = zfd.formData(signInSchema);
export const magicLinkSignInSchema = z.object({
  email: emailSchema,
});
export const magicLinkSignInFormDataSchema = zfd.formData(
  magicLinkSignInSchema,
);
export const magicLinkCodeSchema = z.object({
  email: emailSchema,
  otp: z.string().min(1, "Verification code is required"),
});
export const magicLinkCodeFormDataSchema = zfd.formData(magicLinkCodeSchema);

export const signUpSchema = withMatchingPasswords(
  baseSignUpSchema.extend({
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
    termsAccepted: acceptedTermsSchema,
  }),
);

export type SignInInput = z.infer<typeof signInSchema>;
export type MagicLinkSignInInput = z.infer<typeof magicLinkSignInSchema>;
export type MagicLinkCodeInput = z.infer<typeof magicLinkCodeSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export const magicLinkSignUpSchema = baseSignUpSchema.extend({
  termsAccepted: acceptedTermsSchema,
});
export type MagicLinkSignUpInput = z.infer<typeof magicLinkSignUpSchema>;

// Accept FormData (strings) but emit the same boolean-typed shape
export const signUpFormDataSchema = zfd.formData(
  withMatchingPasswords(
    baseSignUpSchema.extend({
      password: passwordSchema,
      confirmPassword: confirmPasswordSchema,
      termsAccepted: acceptedTermsFormField,
    }),
  ),
);

export const magicLinkSignUpFormDataSchema = zfd.formData(
  baseSignUpSchema.extend({
    termsAccepted: acceptedTermsFormField,
  }),
);

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = withMatchingPasswords(
  z.object({
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
    token: z.string().min(1, "Token is required"),
  }),
);

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateNameSchema = z.object({
  name: nameSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

export const updateNameFormDataSchema = zfd.formData(updateNameSchema);
export const changePasswordFormDataSchema = zfd.formData(changePasswordSchema);
export const deleteAccountFormDataSchema = zfd.formData(deleteAccountSchema);
export type { ActivityFeedFilter } from "./activity";
export type { ActivityQueryInput, ParsedActivityQuery } from "./activity";
export type { ActivityPaginationFromLimit } from "./activity";
export {
  ACTIVITY_PAGE_SIZE_DEFAULT,
  ACTIVITY_PAGE_SIZE_MAX,
  ACTIVITY_PAGE_SIZE_MIN,
  activityApiSearchParamsSchema,
  activityFeedFilterSchema,
  activityPaginationFromLimitParamSchema,
  activityQueryInputSchema,
  parseActivityQueryInput,
} from "./activity";
export {
  agentCountsQuerySchema,
  agentEarningsQuerySchema,
  agentVerifyQuerySchema,
  credentialReconcileQuerySchema,
  credentialStatusQuerySchema,
  dashboardOverviewQuerySchema,
  type EarningsPeriod,
  earningsQuerySchema,
  parseNetwork,
} from "./api-query";
export {
  getCanonicalInboxAgentSlug,
  inboxAgentFilterStatusSchema,
  inboxAgentIdRouteParamSchema,
  inboxAgentsListQuerySchema,
  inboxAgentStateSchema,
  type RegisterInboxAgentBody,
  registerInboxAgentBodySchema,
  validateCanonicalInboxAgentSlug,
} from "./inbox-agent";
