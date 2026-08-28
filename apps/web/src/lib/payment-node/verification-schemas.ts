/**
 * KERI/Veridian verification metadata mirrored from payment-service
 * (`packages/payment-core/src/verification.ts`).
 */

import { z } from "zod";

export const VerificationMethod = {
  KeriAcdc: "KERI-ACDC",
} as const;

const keriIdentifierSchema = z.string().min(1).max(128);
const oobiUrlSchema = z.string().url().max(500);

export const verificationSchema = z.object({
  method: z.string().min(1).max(40),
  schemaVersion: z.string().max(16).optional(),
  issuer: z.object({
    aid: keriIdentifierSchema,
    oobi: oobiUrlSchema,
  }),
  schema: z.object({
    said: keriIdentifierSchema,
    oobi: oobiUrlSchema,
  }),
  credential: z.object({
    said: keriIdentifierSchema,
    oobi: oobiUrlSchema,
    registry: keriIdentifierSchema.optional(),
  }),
  holder: z.object({
    aid: keriIdentifierSchema,
    oobi: oobiUrlSchema,
  }),
  baseUrl: oobiUrlSchema.optional(),
});

export const verificationsSchema = z.array(verificationSchema).max(10);

export type Verification = z.infer<typeof verificationSchema>;
export type Verifications = z.infer<typeof verificationsSchema>;
