import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import { z } from "@/lib/zod-openapi";

const termsAcceptedMessage =
  "You must agree to the terms of service and privacy policy";

export const registerByEmailApiBodySchema = z
  .object({
    name: z.string().min(1, "Name is required").openapi({
      example: "Ada Lovelace",
    }),
    email: z.string().email("Please enter a valid email address").openapi({
      example: "ada@example.com",
    }),
    termsAccepted: z.boolean().refine((value) => value === true, {
      message: termsAcceptedMessage,
    }),
    callbackUrl: z
      .string()
      .optional()
      .refine((value) => value == null || sanitizeCallbackUrl(value) != null, {
        message: "Callback URL must be a same-origin path",
      })
      .openapi({
        example: "/",
        description:
          "Optional same-origin path to open after the magic link is used.",
      }),
  })
  .openapi({
    example: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      termsAccepted: true,
      callbackUrl: "/",
    },
  });

export type RegisterByEmailApiBody = z.infer<
  typeof registerByEmailApiBodySchema
>;

export const registerByEmailApiSuccessSchema = z
  .object({
    success: z.literal(true),
    resultKey: z.literal("MagicLinkSent"),
    email: z.string().email(),
  })
  .openapi({
    example: {
      success: true,
      resultKey: "MagicLinkSent",
      email: "ada@example.com",
    },
  });
