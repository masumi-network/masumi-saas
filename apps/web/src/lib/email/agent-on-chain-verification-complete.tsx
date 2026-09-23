import { render } from "@react-email/components";

import {
  MasumiEmailButton,
  MasumiEmailDetailBlock,
  MasumiEmailLayout,
  MasumiEmailParagraph,
} from "./masumi-email-layout";

interface AgentOnChainVerificationCompleteEmailProps {
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

export const AgentOnChainVerificationCompleteEmail = ({
  userName,
  agentName,
  viewAgentUrl,
  preview,
  title,
  greeting,
  message,
  button,
  footer,
}: AgentOnChainVerificationCompleteEmailProps) => (
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

export async function reactAgentOnChainVerificationCompleteEmail(
  props: AgentOnChainVerificationCompleteEmailProps,
) {
  return await render(<AgentOnChainVerificationCompleteEmail {...props} />);
}
