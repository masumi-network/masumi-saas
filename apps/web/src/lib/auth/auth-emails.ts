import "server-only";

import prisma from "@masumi/database/client";
import { APIError } from "better-auth";
import type { magicLink, organization } from "better-auth/plugins";
import { headers } from "next/headers";

import {
  buildStoredOtpValue,
  createVerificationValue,
  deleteVerificationByIdentifier,
} from "@/lib/auth/auth-storage";
import { displayNameFromEmail } from "@/lib/auth/display-name-from-email";
import {
  checkAndIncrementEmailSendLimit,
  EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS,
  EMAIL_SEND_RATE_LIMIT_WINDOW_MS,
} from "@/lib/auth/email-send-rate-limit";
import { isOidcMagicLinkCallbackUrl } from "@/lib/auth/magic-link-callback";
import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig, getPostmarkFromHeader } from "@/lib/config/email.config";
import { PRIVACY_POLICY_URL } from "@/lib/config/privacy-policy-url";
import { reactAgentMessengerMagicLinkEmail } from "@/lib/email/agent-messenger-magic-link";
import { formatOtpExpiryMessage } from "@/lib/email/format-otp-expiry-message";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { reactMagicLinkEmail } from "@/lib/email/magic-link";
import { getEmailMessages, parseAcceptLanguage } from "@/lib/email/messages";
import { postmarkClient } from "@/lib/email/postmark";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { reactVerificationEmail } from "@/lib/email/verification";
import { reactVerificationCodeEmail } from "@/lib/email/verification-code";

type MagicLinkOptions = Parameters<typeof magicLink>[0];
type SendMagicLink = MagicLinkOptions["sendMagicLink"];
type OrganizationOptions = NonNullable<Parameters<typeof organization>[0]>;
type SendInvitationEmail = NonNullable<
  OrganizationOptions["sendInvitationEmail"]
>;
type AuthEmailUser = { email: string; name?: string | null };

/**
 * Caps how many auth emails (magic-link + verification codes) any single
 * email address can receive per rolling window. The counter is reset when
 * the recipient either successfully redeems a magic-link code or verifies
 * their email address.
 */
export async function enforceEmailSendRateLimit(email: string): Promise<void> {
  const result = await checkAndIncrementEmailSendLimit(email);
  if (result.allowed) {
    return;
  }

  const retryAfterMinutes = Math.max(
    1,
    Math.ceil(result.retryAfterSeconds / 60),
  );
  throw new APIError("TOO_MANY_REQUESTS", {
    message: `Too many email requests. Please try again in ${retryAfterMinutes} minute(s). Max ${EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS} emails per ${Math.round(EMAIL_SEND_RATE_LIMIT_WINDOW_MS / 60000)} minutes.`,
    code: "TOO_MANY_EMAIL_REQUESTS",
  });
}

function generateEmailVerificationCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

type EmailOtpType = "email-verification" | "sign-in";

function logDevCode(label: string, email: string, otp: string) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log(`\n[DEV] ${label}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To: ${email}`);
  console.log(`Verification Code: ${otp}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function createEmailOtp(
  email: string,
  type: EmailOtpType,
): Promise<string> {
  const identifier = `${type}-otp-${email.toLowerCase()}`;
  const otp = generateEmailVerificationCode();

  await deleteVerificationByIdentifier(identifier);

  await createVerificationValue({
    id: crypto.randomUUID(),
    identifier,
    value: buildStoredOtpValue(otp),
    expiresAt: new Date(
      Date.now() + authConfig.emailOtp.expiresInSeconds * 1000,
    ),
  });

  return otp;
}

async function createEmailVerificationOtp(email: string): Promise<string> {
  return await createEmailOtp(email, "email-verification");
}

async function createMagicLinkOtp(email: string): Promise<string> {
  return await createEmailOtp(email, "sign-in");
}

export async function sendVerificationOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  if (process.env.NODE_ENV === "development") {
    logDevCode("Email verification code", email, otp);
    if (!postmarkClient) {
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
      return;
    }
  }

  if (!postmarkClient) {
    console.error("Postmark not configured. Email verification OTP failed.", {
      to: email,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send verification code. Please try again.",
    });
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const msg = getEmailMessages(locale).VerificationCode;

  await postmarkClient.sendEmail({
    From: getPostmarkFromHeader("verification"),
    To: email,
    Tag: "verification-code",
    Subject: msg.preview,
    HtmlBody: await reactVerificationCodeEmail({
      name: displayNameFromEmail(email),
      otpCode: otp,
      translations: {
        preview: msg.preview,
        title: msg.title,
        greeting: msg.greeting,
        message: msg.message,
        codeLabel: msg.codeLabel,
        expiry: formatOtpExpiryMessage(msg.expiry),
        footer: msg.footer,
      },
    }),
    MessageStream: "outbound",
  });
}

export async function sendResetPasswordEmail({
  user,
  url,
}: {
  user: AuthEmailUser;
  url: string;
}) {
  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log("\n[DEV] Password reset email (Postmark not configured)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Reset Link: ${url}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
    } else {
      console.error("Postmark not configured. Password reset email failed.", {
        to: user.email,
      });
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to send password reset email. Please try again.",
      });
    }
    return;
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const msg = getEmailMessages(locale);

  await postmarkClient.sendEmail({
    From: getPostmarkFromHeader("passwordReset"),
    To: user.email,
    Tag: "reset-password",
    Subject: msg.ResetPassword.preview,
    HtmlBody: await reactResetPasswordEmail({
      name: user.name || "User",
      resetLink: url,
      translations: {
        preview: msg.ResetPassword.preview,
        title: msg.ResetPassword.title,
        greeting: msg.ResetPassword.greeting,
        message: msg.ResetPassword.message,
        button: msg.ResetPassword.button,
        footer: msg.ResetPassword.footer,
      },
    }),
    MessageStream: "outbound",
  });
}

export async function sendVerificationLinkEmail(
  { user, url }: { user: AuthEmailUser; url: string },
  request?: Request,
) {
  const isResend =
    typeof request?.url === "string" &&
    request.url.includes("send-verification-email");
  await enforceEmailSendRateLimit(user.email);
  const verificationCode = await createEmailVerificationOtp(user.email);

  if (process.env.NODE_ENV === "development") {
    console.log("\n[DEV] Email verification link");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`To: ${user.email}`);
    console.log(`Verification Link: ${url}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logDevCode("Email verification code", user.email, verificationCode);
  }

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
      return;
    }
    console.error("Postmark not configured. Email verification failed.", {
      to: user.email,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send verification email. Please try again.",
    });
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const msg = getEmailMessages(locale).Verification;

  try {
    await postmarkClient.sendEmail({
      From: getPostmarkFromHeader("verification"),
      To: user.email,
      Tag: "verification-email",
      Subject: msg.preview,
      HtmlBody: await reactVerificationEmail({
        name: user.name || "User",
        verificationLink: url,
        verificationCode,
        logoUrl: emailConfig.brandLogoUrl,
        translations: {
          preview: msg.preview,
          title: msg.title,
          greeting: msg.greeting,
          message: msg.message,
          button: msg.button,
          codeLabel: msg.codeLabel,
          codeExpiry: formatOtpExpiryMessage(msg.codeExpiry),
          codeHelp: msg.codeHelp,
          footer: msg.footer,
        },
      }),
      MessageStream: "outbound",
    });
  } catch (err) {
    console.error("[Postmark] Verification email failed:", err);
    if (isResend) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to send verification email. Please try again.",
      });
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[DEV] Verification link (Postmark failed):", url);
    }
  }
}

export const sendMagicLinkEmail: SendMagicLink = async (
  { email, url },
  ctx,
) => {
  await enforceEmailSendRateLimit(email);
  const requestedName =
    typeof ctx?.body?.name === "string" && ctx.body.name.trim().length > 0
      ? ctx.body.name.trim()
      : null;
  const callbackUrl =
    typeof ctx?.body?.callbackURL === "string"
      ? ctx.body.callbackURL
      : typeof ctx?.body?.newUserCallbackURL === "string"
        ? ctx.body.newUserCallbackURL
        : undefined;
  const isOidcMagicLink = isOidcMagicLinkCallbackUrl(callbackUrl);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { name: true },
  });
  const name =
    existingUser?.name?.trim() || requestedName || displayNameFromEmail(email);
  const magicCode = await createMagicLinkOtp(email);

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log("\n[DEV] Magic link email (Postmark not configured)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${email}`);
      console.log(`Magic Link: ${url}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logDevCode("Magic link sign-in code", email, magicCode);
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
      return;
    }
    console.error("Postmark not configured. Magic link email failed.", {
      to: email,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send magic link. Please try again.",
    });
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const emailMessages = getEmailMessages(locale);
  const msg = isOidcMagicLink
    ? emailMessages.MagicLinkOidc
    : emailMessages.MagicLink;

  try {
    if (process.env.NODE_ENV === "development") {
      logDevCode("Magic link sign-in code", email, magicCode);
    }

    const htmlBody = isOidcMagicLink
      ? await reactAgentMessengerMagicLinkEmail({
          name,
          magicLink: url,
          magicCode,
          logoUrl: emailConfig.agentMessengerLogoUrl,
          poweredByLogoUrl: emailConfig.brandLogoUrl,
          includePrivacyConsent: !existingUser,
          privacyPolicyUrl: PRIVACY_POLICY_URL,
          translations: {
            preview: msg.preview,
            title: msg.title,
            greeting: msg.greeting,
            message: msg.message,
            consentBefore: msg.consentBefore,
            consentPrivacyLabel: msg.consentPrivacyLabel,
            consentAfter: msg.consentAfter,
            button: msg.button,
            codeLabel: msg.codeLabel,
            codeExpiry: formatOtpExpiryMessage(msg.codeExpiry),
            codeHelp: msg.codeHelp,
            footer: msg.footer,
          },
        })
      : await reactMagicLinkEmail({
          name,
          magicLink: url,
          magicCode,
          logoUrl: emailConfig.brandLogoUrl,
          includePrivacyConsent: !existingUser,
          privacyPolicyUrl: PRIVACY_POLICY_URL,
          translations: {
            preview: msg.preview,
            title: msg.title,
            greeting: msg.greeting,
            message: msg.message,
            consentBefore: msg.consentBefore,
            consentPrivacyLabel: msg.consentPrivacyLabel,
            consentAfter: msg.consentAfter,
            button: msg.button,
            codeLabel: msg.codeLabel,
            codeExpiry: formatOtpExpiryMessage(msg.codeExpiry),
            codeHelp: msg.codeHelp,
            footer: msg.footer,
          },
        });

    await postmarkClient.sendEmail({
      From: getPostmarkFromHeader(
        isOidcMagicLink ? "agentMessenger" : "magicLink",
      ),
      To: email,
      Tag: "magic-link",
      Subject: msg.preview,
      HtmlBody: htmlBody,
      MessageStream: "outbound",
    });
  } catch (err) {
    console.error("[Postmark] Magic link email failed:", err);
    if (process.env.NODE_ENV === "development") {
      console.log("[DEV] Magic link (Postmark failed):", url);
      // Do not fail local auth when Postmark credentials are bad.
      return;
    }
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send magic link. Please try again.",
    });
  }
};

export const sendOrganizationInvitationEmail: SendInvitationEmail = async (
  data,
) => {
  const inviteLink = `${authEnvConfig.baseUrl}/accept-invitation/${data.id}`;

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log("\n[DEV] Invitation email (Postmark not configured)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${data.email}`);
      console.log(`Organization: ${data.organization.name}`);
      console.log(`Invite Link: ${inviteLink}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
      return;
    }
    console.error("Postmark not configured. Invitation email failed.", {
      to: data.email,
      organizationId: data.organization.id,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send invitation email. Please try again.",
    });
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const msg = getEmailMessages(locale).Invitation;
  const orgName = data.organization.name;
  const replaceOrganization = (template: string): string =>
    template.replace("{organization}", () => orgName);

  const roleName =
    data.role === "admin"
      ? "Admin"
      : data.role === "owner"
        ? "Owner"
        : "Member";

  await postmarkClient.sendEmail({
    From: getPostmarkFromHeader("invitation"),
    To: data.email,
    Tag: "organization-invitation",
    Subject: replaceOrganization(msg.preview),
    HtmlBody: await reactInvitationEmail({
      inviteLink,
      organizationName: orgName,
      inviterName: data.inviter.user.name || data.inviter.user.email,
      role: roleName,
      logoUrl: emailConfig.brandLogoUrl,
      translations: {
        preview: replaceOrganization(msg.preview),
        title: replaceOrganization(msg.title),
        greeting: msg.greeting,
        message: msg.message,
        button: msg.button,
        footer: msg.footer,
      },
    }),
    MessageStream: "outbound",
  });
};
