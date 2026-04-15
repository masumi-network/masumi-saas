import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface ResetPasswordEmailProps {
  name: string;
  resetLink: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    button: string;
    footer: string;
  };
}

export const ResetPasswordEmail = ({
  name,
  resetLink,
  translations: t,
}: ResetPasswordEmailProps) => (
  <MasumiEmailLayout
    preview={t.preview}
    title={t.title}
    greeting={t.greeting.replace("{name}", name)}
    footer={t.footer}
  >
    <MasumiEmailParagraph>{t.message}</MasumiEmailParagraph>
    <MasumiEmailButton href={resetLink}>{t.button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactResetPasswordEmail(props: ResetPasswordEmailProps) {
  return await render(<ResetPasswordEmail {...props} />);
}
