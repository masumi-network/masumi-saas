import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailDetailBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface InvitationEmailProps {
  inviteLink: string;
  organizationName: string;
  inviterName: string;
  role: string;
  logoUrl?: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    button: string;
    footer: string;
  };
}

export const InvitationEmail = ({
  inviteLink,
  organizationName,
  inviterName,
  role,
  logoUrl,
  translations: t,
}: InvitationEmailProps) => (
  <MasumiEmailLayout
    preview={t.preview}
    title={t.title.replace("{organization}", organizationName)}
    greeting={t.greeting.replace(
      /\{(inviter|organization|role)\}/g,
      (_match, key: "inviter" | "organization" | "role") =>
        ({ inviter: inviterName, organization: organizationName, role })[key],
    )}
    footer={t.footer}
    logoUrl={logoUrl}
  >
    <MasumiEmailParagraph>{t.message}</MasumiEmailParagraph>
    <MasumiEmailDetailBlock label="Organization" value={organizationName} />
    <MasumiEmailDetailBlock label="Role" value={role} />
    <MasumiEmailButton href={inviteLink}>{t.button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactInvitationEmail(props: InvitationEmailProps) {
  return await render(<InvitationEmail {...props} />);
}
