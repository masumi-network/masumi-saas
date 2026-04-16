import "server-only";

import prisma from "@masumi/database/client";

export const EMAIL_SEND_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;
export const EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS = 5;

export type EmailSendRateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// Maximum number of times the check will retry after losing a race with a
// concurrent inserter (Prisma P2002) before giving up. Two retries is enough
// for any realistic level of contention: the first retry re-reads the row
// just created by the winner; the second is a safety net for pathological
// cases (e.g. the winning row was deleted by a reset in between).
const MAX_CONCURRENCY_RETRIES = 2;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

function computeRetryAfterSeconds(windowStart: Date, now: Date): number {
  const age = now.getTime() - windowStart.getTime();
  return Math.max(1, Math.ceil((EMAIL_SEND_RATE_LIMIT_WINDOW_MS - age) / 1000));
}

/**
 * Records an auth email send and returns whether the caller may proceed.
 *
 * The counter rolls over after {@link EMAIL_SEND_RATE_LIMIT_WINDOW_MS} since
 * the first send in the window and is capped at
 * {@link EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS}.
 *
 * Concurrency: the initial `findUnique` → `create` path is not atomic on its
 * own. Two concurrent callers for a never-seen email can both read `null`
 * and both try to create, with the loser hitting a Prisma P2002 unique
 * constraint on `email`. We catch that specific error and retry the loop;
 * on the retry the row now exists and we fall into the update branch.
 * Increment-within-window is handled by `{ increment: 1 }`, which is atomic
 * at the DB level, so concurrent callers may overshoot the cap by at most
 * the number of in-flight requests — an acceptable trade-off versus taking
 * a row lock on every send.
 */
export async function checkAndIncrementEmailSendLimit(
  email: string,
): Promise<EmailSendRateLimitCheck> {
  const normalized = normalizeEmail(email);

  for (let attempt = 0; attempt <= MAX_CONCURRENCY_RETRIES; attempt++) {
    const now = new Date();

    const existing = await prisma.emailSendRateLimit.findUnique({
      where: { email: normalized },
      select: { count: true, windowStart: true },
    });

    if (!existing) {
      try {
        await prisma.emailSendRateLimit.create({
          data: { email: normalized, count: 1, windowStart: now },
        });
        return { allowed: true };
      } catch (err) {
        if (isUniqueConstraintViolation(err)) {
          // Lost the race to another concurrent inserter — retry and fall
          // into the update branch now that the row exists.
          continue;
        }
        throw err;
      }
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
      return {
        allowed: false,
        retryAfterSeconds: computeRetryAfterSeconds(existing.windowStart, now),
      };
    }

    await prisma.emailSendRateLimit.update({
      where: { email: normalized },
      data: { count: { increment: 1 } },
    });
    return { allowed: true };
  }

  // Exhausted retries — extremely unlikely, but fail closed to avoid a 500.
  // Treating it as "rate limited for a minute" is safer than crashing auth.
  return { allowed: false, retryAfterSeconds: 60 };
}

/** Clears the rate-limit counter for an email after a successful auth event. */
export async function resetEmailSendLimit(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await prisma.emailSendRateLimit.deleteMany({
    where: { email: normalized },
  });
}
