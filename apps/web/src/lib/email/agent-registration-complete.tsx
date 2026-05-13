import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailDetailBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface AgentRegistrationCompleteEmailProps {
  userName: string;
  agentName: string;
  viewAgentUrl: string;
  preview: string;
  title: string;
  greeting: string;
  message: string;
  button: string;
  footer: string;
}

export const AgentRegistrationCompleteEmail = ({
  userName,
  agentName,
  viewAgentUrl,
  preview,
  title,
  greeting,
  message,
  button,
  footer,
}: AgentRegistrationCompleteEmailProps) => (
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
    <MasumiEmailButton href={viewAgentUrl}>{button}</MasumiEmailButton>
  </MasumiEmailLayout>
);

export async function reactAgentRegistrationCompleteEmail(
  props: AgentRegistrationCompleteEmailProps,
) {
  return await render(<AgentRegistrationCompleteEmail {...props} />);
}
