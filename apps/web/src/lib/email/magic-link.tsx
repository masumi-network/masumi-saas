import { Link, render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailCodeBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface MagicLinkEmailProps {
  name: string;
  magicLink: string;
  magicCode?: string;
  logoUrl?: string;
  includePrivacyConsent?: boolean;
  privacyPolicyUrl?: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    consentBefore: string;
    consentPrivacyLabel: string;
    consentAfter: string;
    button: string;
    codeLabel: string;
    codeExpiry: string;
    codeHelp: string;
    footer: string;
  };
}

export const MagicLinkEmail = ({
  name,
  magicLink,
  magicCode,
  logoUrl,
  includePrivacyConsent,
  privacyPolicyUrl,
  translations: t,
}: MagicLinkEmailProps) => (
  <MasumiEmailLayout
    preview={t.preview}
    title={t.title}
    greeting={t.greeting.replace("{name}", name)}
    footer={t.footer}
    logoUrl={logoUrl}
  >
    <MasumiEmailParagraph>{t.message}</MasumiEmailParagraph>

    {magicCode ? (
      <>
        <MasumiEmailParagraph>{t.codeHelp}</MasumiEmailParagraph>
        <MasumiEmailCodeBlock
          label={t.codeLabel}
          code={magicCode}
          helperText={t.codeExpiry}
        />
      </>
    ) : null}

    {includePrivacyConsent && privacyPolicyUrl ? (
      <MasumiEmailParagraph>
        {t.consentBefore}
        <Link
          href={privacyPolicyUrl}
          className="font-medium text-[#ff51ff] no-underline"
        >
          {t.consentPrivacyLabel}
        </Link>
        {t.consentAfter}
      </MasumiEmailParagraph>
    ) : null}

    <MasumiEmailButton href={magicLink}>{t.button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactMagicLinkEmail(props: MagicLinkEmailProps) {
  return await render(<MagicLinkEmail {...props} />);
}
