import "server-only";

import prisma from "@masumi/database/client";

export const EMAIL_SEND_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
export const EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS = 5;

export type EmailSendRateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Atomically records an auth email send and returns whether the caller may
 * proceed. The counter rolls over after {@link EMAIL_SEND_RATE_LIMIT_WINDOW_MS}
 * since the first send in the window and is capped at
 * {@link EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS}.
 */
export async function checkAndIncrementEmailSendLimit(
  email: string,
): Promise<EmailSendRateLimitCheck> {
  const normalized = normalizeEmail(email);
  const now = new Date();

  const existing = await prisma.emailSendRateLimit.findUnique({
    where: { email: normalized },
    select: { count: true, windowStart: true },
  });

  if (!existing) {
    await prisma.emailSendRateLimit.create({
      data: { email: normalized, count: 1, windowStart: now },
    });
    return { allowed: true };
  }

  const age = now.getTime() - existing.windowStart.getTime();
  if (age >= EMAIL_SEND_RATE_LIMIT_WINDOW_MS) {
    await prisma.emailSendRateLimit.update({
      where: { email: normalized },
      data: { count: 1, windowStart: now },
    });
    return { allowed: true };
  }

  if (existing.count >= EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((EMAIL_SEND_RATE_LIMIT_WINDOW_MS - age) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  await prisma.emailSendRateLimit.update({
    where: { email: normalized },
    data: { count: { increment: 1 } },
  });
  return { allowed: true };
}

/** Clears the rate-limit counter for an email after a successful auth event. */
export async function resetEmailSendLimit(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await prisma.emailSendRateLimit.deleteMany({
    where: { email: normalized },
  });
}
