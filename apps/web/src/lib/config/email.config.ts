import { authEnvConfig } from "./auth.config";

/** Default Masumi mark used in transactional emails when EMAIL_BRAND_LOGO_URL is unset. */
const DEFAULT_EMAIL_BRAND_LOGO_URL = `${authEnvConfig.baseUrl}/assets/logo.png`;
const DEFAULT_POSTMARK_FROM_NAME = "Masumi";
const DEFAULT_POSTMARK_FROM_ADDRESS = "support@masumi.network";
const POSTMARK_FROM_HEADER_REGEX = /^(?:"?([^"]+?)"?\s*)?<([^>]+)>$/;
const NO_REPLY_LOCAL_PART_REGEX = /^no-?reply$/i;
const NO_REPLY_DISPLAY_NAME_REGEX = /^no[\s-]?reply$/i;

export type TransactionalEmailSender =
  | "default"
  | "verification"
  | "passwordReset"
  | "magicLink"
  | "invitation"
  | "agentRegistration"
  | "agentMessenger";

function normalizeFromAddress(address: string): string {
  const trimmed = address.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (NO_REPLY_LOCAL_PART_REGEX.test(localPart)) {
    return `support@${domain}`;
  }

  return trimmed;
}

function resolvePostmarkFrom() {
  const rawFrom = process.env.POSTMARK_FROM_EMAIL?.trim();
  const headerMatch = rawFrom?.match(POSTMARK_FROM_HEADER_REGEX);
  const configuredAddress = headerMatch?.[2] ?? rawFrom;
  const configuredName = headerMatch?.[1]?.trim();

  const address = normalizeFromAddress(
    configuredAddress || DEFAULT_POSTMARK_FROM_ADDRESS,
  );
  const name =
    process.env.POSTMARK_FROM_NAME?.trim() ||
    (configuredName && !NO_REPLY_DISPLAY_NAME_REGEX.test(configuredName)
      ? configuredName
      : undefined) ||
    DEFAULT_POSTMARK_FROM_NAME;

  return {
    address,
    baseName: name,
    header: `${name} <${address}>`,
  };
}

const postmarkFrom = resolvePostmarkFrom();

function buildFromHeader(name: string, address: string): string {
  return `${name} <${address}>`;
}

function resolveSenderName(sender: TransactionalEmailSender): string {
  switch (sender) {
    case "verification":
      return `${postmarkFrom.baseName} Verification`;
    case "passwordReset":
      return `${postmarkFrom.baseName} Password Reset`;
    case "magicLink":
      return `${postmarkFrom.baseName} Sign-In`;
    case "invitation":
      return `${postmarkFrom.baseName} Invitation`;
    case "agentRegistration":
      return `${postmarkFrom.baseName} Agent Updates`;
    case "agentMessenger":
      return "Agent Messenger";
    case "default":
    default:
      return postmarkFrom.baseName;
  }
}

export function getPostmarkFromHeader(
  sender: TransactionalEmailSender = "default",
): string {
  return buildFromHeader(resolveSenderName(sender), postmarkFrom.address);
}

export const emailConfig = {
  postmarkServerId: process.env.POSTMARK_SERVER_ID,
  postmarkFromAddress: postmarkFrom.address,
  postmarkFromName: postmarkFrom.baseName,
  postmarkFromHeader: getPostmarkFromHeader(),
  brandLogoUrl:
    process.env.EMAIL_BRAND_LOGO_URL?.trim() || DEFAULT_EMAIL_BRAND_LOGO_URL,
  agentMessengerLogoUrl:
    process.env.EMAIL_AGENT_MESSENGER_LOGO_URL?.trim() ||
    process.env.EMAIL_BRAND_LOGO_URL?.trim() ||
    DEFAULT_EMAIL_BRAND_LOGO_URL,
};
