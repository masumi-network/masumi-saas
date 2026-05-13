import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailCodeBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface VerificationEmailProps {
  name: string;
  verificationLink: string;
  verificationCode?: string;
  logoUrl?: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    button: string;
    codeLabel?: string;
    codeExpiry?: string;
    codeHelp?: string;
    footer: string;
  };
}

export const VerificationEmail = ({
  name,
  verificationLink,
  verificationCode,
  logoUrl,
  translations: t,
}: VerificationEmailProps) => (
  <MasumiEmailLayout
    preview={t.preview}
    title={t.title}
    greeting={t.greeting.replace("{name}", name)}
    footer={t.footer}
    logoUrl={logoUrl}
  >
    <MasumiEmailParagraph>{t.message}</MasumiEmailParagraph>

    {verificationCode ? (
      <>
        {t.codeHelp ? (
          <MasumiEmailParagraph>{t.codeHelp}</MasumiEmailParagraph>
        ) : null}
        <MasumiEmailCodeBlock
          label={t.codeLabel ?? "Verification code"}
          code={verificationCode}
          helperText={t.codeExpiry}
        />
      </>
    ) : null}

    <MasumiEmailButton href={verificationLink}>{t.button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactVerificationEmail(props: VerificationEmailProps) {
  return await render(<VerificationEmail {...props} />);
}
