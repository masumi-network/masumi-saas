/**
 * Email copy for transactional emails (reset password, verification, invitation).
 * Loaded directly from messages so auth callbacks don't depend on next-intl
 * request context (which can be missing in API routes and would show raw keys
 * like "Email.Verification.greeting").
 */
import en from "../../../messages/en.json";

type EmailEn = (typeof en)["Email"];

export const emailMessagesEn: EmailEn = (en as { Email: EmailEn }).Email;
