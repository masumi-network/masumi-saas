import prisma from "@masumi/database/client";

import { authEnvConfig } from "@/lib/config/auth.config";
import { getPostmarkFromHeader } from "@/lib/config/email.config";
import { reactAgentOnChainVerificationCompleteEmail } from "@/lib/email/agent-on-chain-verification-complete";
import { postmarkClient } from "@/lib/email/postmark";

const DEFAULT_MESSAGES = {
  preview: "Your agent verification is now recorded on the Masumi network",
  title: "On-chain verification complete",
  greeting: "Hi {name},",
  message:
    'Verification for your agent "{agentName}" is now anchored on-chain in the Masumi registry. You can view the verification status from your dashboard.',
  button: "View verification",
  footer:
    "You received this email because you completed agent verification on Masumi. If you did not expect this, you can safely ignore it.",
};

export async function sendOnChainVerificationCompleteEmail(
  userId: string,
  agentId: string,
  agentName: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const viewAgentUrl = `${authEnvConfig.baseUrl}/ai-agents/${agentId}?tab=verification`;

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "\n[DEV] On-chain verification complete email (Postmark not configured)",
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Agent: ${agentName}`);
      console.log(`View: ${viewAgentUrl}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }
    return;
  }

  try {
    await postmarkClient.sendEmail({
      From: getPostmarkFromHeader("agentRegistration"),
      To: user.email,
      Tag: "agent-on-chain-verification-complete",
      Subject: DEFAULT_MESSAGES.title,
      HtmlBody: await reactAgentOnChainVerificationCompleteEmail({
        userName: user.name || "User",
        agentName,
        viewAgentUrl,
        ...DEFAULT_MESSAGES,
      }),
      MessageStream: "outbound",
    });
  } catch (err) {
    console.error(
      "[Postmark] On-chain verification complete email failed:",
      err,
    );
  }
}
