import { render } from "@react-email/components";

import {
  MasumiEmailCodeBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface VerificationCodeEmailProps {
  name: string;
  otpCode: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    codeLabel: string;
    expiry: string;
    footer: string;
  };
}

export const VerificationCodeEmail = ({
  name,
  otpCode,
  translations: t,
}: VerificationCodeEmailProps) => (
  <MasumiEmailLayout
    preview={t.preview}
    title={t.title}
    greeting={t.greeting.replace("{name}", name)}
    footer={t.footer}
  >
    <MasumiEmailParagraph>{t.message}</MasumiEmailParagraph>
    <MasumiEmailCodeBlock
      label={t.codeLabel}
      code={otpCode}
      helperText={t.expiry}
    />
  </MasumiEmailLayout>
);

export async function reactVerificationCodeEmail(
  props: VerificationCodeEmailProps,
) {
  return await render(<VerificationCodeEmail {...props} />);
}
