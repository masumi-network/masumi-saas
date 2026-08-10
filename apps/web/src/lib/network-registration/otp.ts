import "server-only";

import { randomUUID } from "node:crypto";

import prisma from "@masumi/database/client";

import { auth } from "@/lib/auth/auth";
import {
  buildStoredOtpValue,
  createVerificationValue,
  deleteVerificationByIdentifier,
  findVerificationByIdentifier,
  updateVerificationValue,
} from "@/lib/auth/auth-storage";
import { displayNameFromEmail } from "@/lib/auth/display-name-from-email";
import {
  checkAndIncrementEmailSendLimit,
  resetEmailSendLimit,
} from "@/lib/auth/email-send-rate-limit";
import { authConfig } from "@/lib/config/auth.config";
import { getPostmarkFromHeader } from "@/lib/config/email.config";
import { grantInitialCreditsIfNeeded } from "@/lib/credits/service";
import { getEmailMessages } from "@/lib/email/messages";
import { postmarkClient } from "@/lib/email/postmark";
import { reactVerificationCodeEmail } from "@/lib/email/verification-code";

function generateEmailVerificationCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

function logDevCode(email: string, otp: string) {
  console.log("\n[DEV] Network registration code");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To: ${email}`);
  console.log(`Verification Code: ${otp}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

async function createSignInOtp(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const identifier = `sign-in-otp-${normalized}`;
  const otp = generateEmailVerificationCode();

  await deleteVerificationByIdentifier(identifier);
  await createVerificationValue({
    id: randomUUID(),
    identifier,
    value: buildStoredOtpValue(otp),
    expiresAt: new Date(
      Date.now() + authConfig.emailOtp.expiresInSeconds * 1000,
    ),
  });

  return otp;
}

async function ensureNetworkRegistrationUser(params: {
  email: string;
  name: string;
}): Promise<{ id: string; email: string; name: string }> {
  const email = params.email.trim().toLowerCase();
  const name =
    params.name.trim().length > 0
      ? params.name.trim()
      : displayNameFromEmail(email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
    };
  }

  const created = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      name,
      emailVerified: false,
      termsAccepted: true,
    },
    select: { id: true, email: true, name: true },
  });

  // Initial credits are granted only after email OTP verification.
  return created;
}

async function deliverRegistrationOtp(params: {
  email: string;
  name: string;
  otp: string;
}): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    logDevCode(params.email, params.otp);
  }

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      return;
    }
    throw new Error("Email delivery is not configured");
  }

  try {
    const msg = getEmailMessages("en").VerificationCode;
    await postmarkClient.sendEmail({
      From: getPostmarkFromHeader("verification"),
      To: params.email,
      Tag: "network-registration-code",
      Subject: msg.preview,
      HtmlBody: await reactVerificationCodeEmail({
        name: params.name,
        otpCode: params.otp,
        translations: {
          preview: msg.preview,
          title: msg.title,
          greeting: msg.greeting,
          message: msg.message,
          codeLabel: msg.codeLabel,
          expiry: msg.expiry,
          footer: msg.footer,
        },
      }),
      MessageStream: "outbound",
    });
  } catch (error) {
    console.error("[Postmark] Network registration OTP failed:", error);
    if (process.env.NODE_ENV === "development") {
      return;
    }
    throw new Error("Failed to send verification code");
  }
}

export async function sendNetworkRegistrationOtp(params: {
  email: string;
  name: string;
}): Promise<
  | { ok: true; email: string; devCode?: string }
  | { ok: false; error: string; status: 429 | 500 }
> {
  const email = params.email.trim().toLowerCase();

  try {
    const rate = await checkAndIncrementEmailSendLimit(email);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error:
          "Too many email requests. Please wait before requesting another code.",
      };
    }

    await ensureNetworkRegistrationUser({
      email,
      name: params.name,
    });

    const otp = await createSignInOtp(email);
    await deliverRegistrationOtp({
      email,
      name: params.name.trim() || displayNameFromEmail(email),
      otp,
    });

    return {
      ok: true,
      email,
      ...(process.env.NODE_ENV === "development" ? { devCode: otp } : {}),
    };
  } catch (error) {
    console.error("[sendNetworkRegistrationOtp] error:", error);
    return {
      ok: false,
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : "Failed to send verification code",
    };
  }
}

export async function verifyNetworkRegistrationOtp(params: {
  email: string;
  otp: string;
  headers: Headers;
}): Promise<
  | {
      ok: true;
      user: { id: string; name: string | null; email: string | null };
      registrationToken: string;
      sessionHeaders: Headers;
    }
  | { ok: false; error: string }
> {
  const email = params.email.trim().toLowerCase();
  const otp = params.otp.trim();

  try {
    const signIn = await auth.api.signInEmailOTP({
      body: { email, otp },
      headers: params.headers,
      returnHeaders: true,
    });

    const result = signIn.response;
    if (!result?.user?.id) {
      return { ok: false, error: "Invalid verification code" };
    }

    await resetEmailSendLimit(email);

    await prisma.user.update({
      where: { id: result.user.id },
      data: { emailVerified: true },
    });

    await grantInitialCreditsIfNeeded(result.user.id);

    const registrationToken = await issueNetworkRegistrationTicket({
      userId: result.user.id,
      email,
    });

    return {
      ok: true,
      user: {
        id: result.user.id,
        name: result.user.name ?? null,
        email: result.user.email ?? null,
      },
      registrationToken,
      sessionHeaders: signIn.headers,
    };
  } catch (error) {
    console.error("[verifyNetworkRegistrationOtp] error:", error);
    return { ok: false, error: "Invalid or expired verification code" };
  }
}

const NETWORK_REG_TICKET_TTL_MS = 1000 * 60 * 60 * 2; // 2h

function networkRegTicketIdentifier(token: string) {
  return `network-reg-ticket-${token}`;
}

async function issueNetworkRegistrationTicket(params: {
  userId: string;
  email: string;
}): Promise<string> {
  const token = randomUUID();
  await createVerificationValue({
    id: randomUUID(),
    identifier: networkRegTicketIdentifier(token),
    value: JSON.stringify({
      userId: params.userId,
      email: params.email.trim().toLowerCase(),
    }),
    expiresAt: new Date(Date.now() + NETWORK_REG_TICKET_TTL_MS),
  });
  return token;
}

export async function resolveNetworkRegistrationTicket(params: {
  token: string;
  email: string;
}): Promise<
  | { ok: true; userId: string; email: string; token: string; draftId?: string }
  | { ok: false; error: string }
> {
  const token = params.token.trim();
  const email = params.email.trim().toLowerCase();
  if (!token) {
    return { ok: false, error: "Registration token is required" };
  }

  const identifier = networkRegTicketIdentifier(token);
  const row = await findVerificationByIdentifier(identifier, {
    id: true,
    value: true,
    expiresAt: true,
  });

  if (!row) {
    return {
      ok: false,
      error: "Registration session expired. Verify your email again.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await deleteVerificationByIdentifier(identifier);
    return {
      ok: false,
      error: "Registration session expired. Verify your email again.",
    };
  }

  let parsed: { userId?: string; email?: string; draftId?: string };
  try {
    parsed = JSON.parse(row.value) as {
      userId?: string;
      email?: string;
      draftId?: string;
    };
  } catch {
    await deleteVerificationByIdentifier(identifier);
    return { ok: false, error: "Invalid registration session" };
  }

  if (!parsed.userId || !parsed.email || parsed.email !== email) {
    return {
      ok: false,
      error: "Registration session does not match this email",
    };
  }

  return {
    ok: true,
    userId: parsed.userId,
    email: parsed.email,
    token,
    ...(parsed.draftId ? { draftId: parsed.draftId } : {}),
  };
}

export async function bindNetworkRegistrationDraftToTicket(params: {
  token: string;
  draftId: string;
}): Promise<void> {
  const token = params.token.trim();
  const draftId = params.draftId.trim();
  if (!token || !draftId) return;

  const identifier = networkRegTicketIdentifier(token);
  const row = await findVerificationByIdentifier(identifier, {
    id: true,
    value: true,
    expiresAt: true,
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return;

  let parsed: { userId?: string; email?: string; draftId?: string };
  try {
    parsed = JSON.parse(row.value) as {
      userId?: string;
      email?: string;
      draftId?: string;
    };
  } catch {
    return;
  }

  if (parsed.draftId && parsed.draftId !== draftId) return;

  await updateVerificationValue(
    row.id,
    JSON.stringify({
      ...parsed,
      draftId,
    }),
  );
}

export async function rebindNetworkRegistrationDraftToTicket(params: {
  token: string;
  draftId: string;
}): Promise<void> {
  const token = params.token.trim();
  const draftId = params.draftId.trim();
  if (!token || !draftId) return;

  const identifier = networkRegTicketIdentifier(token);
  const row = await findVerificationByIdentifier(identifier, {
    id: true,
    value: true,
    expiresAt: true,
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return;

  let parsed: { userId?: string; email?: string; draftId?: string };
  try {
    parsed = JSON.parse(row.value) as {
      userId?: string;
      email?: string;
      draftId?: string;
    };
  } catch {
    return;
  }

  if (parsed.draftId === draftId) return;

  await updateVerificationValue(
    row.id,
    JSON.stringify({
      ...parsed,
      draftId,
    }),
  );
}

export async function revokeNetworkRegistrationTicket(
  token: string,
): Promise<void> {
  await deleteVerificationByIdentifier(
    networkRegTicketIdentifier(token.trim()),
  );
}

const NETWORK_REG_POLL_TTL_MS = 1000 * 60 * 60 * 24; // 24h — matches draft TTL

function networkRegPollIdentifier(token: string) {
  return `network-reg-poll-${token}`;
}

export async function issueNetworkRegistrationPollToken(params: {
  draftId: string;
  userId: string;
}): Promise<string> {
  const token = randomUUID();
  await createVerificationValue({
    id: randomUUID(),
    identifier: networkRegPollIdentifier(token),
    value: JSON.stringify({
      draftId: params.draftId,
      userId: params.userId,
    }),
    expiresAt: new Date(Date.now() + NETWORK_REG_POLL_TTL_MS),
  });
  return token;
}

export async function resolveNetworkRegistrationPollToken(params: {
  token: string;
  draftId: string;
}): Promise<
  { ok: true; draftId: string; userId: string } | { ok: false; error: string }
> {
  const token = params.token.trim();
  const draftId = params.draftId.trim();
  if (!token || !draftId) {
    return { ok: false, error: "Invalid registration poll session" };
  }

  const identifier = networkRegPollIdentifier(token);
  const row = await findVerificationByIdentifier(identifier, {
    id: true,
    value: true,
    expiresAt: true,
  });

  if (!row) {
    return { ok: false, error: "Registration poll session expired" };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await deleteVerificationByIdentifier(identifier);
    return { ok: false, error: "Registration poll session expired" };
  }

  let parsed: { draftId?: string; userId?: string };
  try {
    parsed = JSON.parse(row.value) as { draftId?: string; userId?: string };
  } catch {
    await deleteVerificationByIdentifier(identifier);
    return { ok: false, error: "Invalid registration poll session" };
  }

  if (!parsed.draftId || !parsed.userId || parsed.draftId !== draftId) {
    return { ok: false, error: "Registration poll session does not match" };
  }

  return { ok: true, draftId: parsed.draftId, userId: parsed.userId };
}
