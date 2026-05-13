import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailDetailBlock,
  MasumiEmailLayout,
  MasumiEmailNoticeBlock,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface AgentRegistrationFailedEmailProps {
  userName: string;
  agentName: string;
  viewAgentUrl: string;
  errorMessage?: string;
  preview: string;
  title: string;
  greeting: string;
  message: string;
  errorLabel: string;
  button: string;
  footer: string;
}

export const AgentRegistrationFailedEmail = ({
  userName,
  agentName,
  viewAgentUrl,
  errorMessage,
  preview,
  title,
  greeting,
  message,
  errorLabel,
  button,
  footer,
}: AgentRegistrationFailedEmailProps) => (
  <MasumiEmailLayout
    preview={preview}
    title={title}
    greeting={greeting.replace("{name}", userName)}
    footer={footer}
  >
    <MasumiEmailParagraph>
      {message.replace("{agentName}", agentName)}
    </MasumiEmailParagraph>
    <MasumiEmailDetailBlock label="Agent" value={agentName} />
    {errorMessage ? (
      <MasumiEmailNoticeBlock
        label={errorLabel}
        message={errorMessage}
        tone="danger"
      />
    ) : null}
    <MasumiEmailButton href={viewAgentUrl}>{button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactAgentRegistrationFailedEmail(
  props: AgentRegistrationFailedEmailProps,
) {
  return await render(<AgentRegistrationFailedEmail {...props} />);
}
