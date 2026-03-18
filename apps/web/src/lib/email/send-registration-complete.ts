import prisma from "@masumi/database/client";

import { authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig } from "@/lib/config/email.config";
import { reactAgentRegistrationCompleteEmail } from "@/lib/email/agent-registration-complete";
import { postmarkClient } from "@/lib/email/postmark";

const DEFAULT_MESSAGES = {
  preview: "Your agent is now registered on the Masumi network",
  title: "Agent registration complete",
  greeting: "Hi {name},",
  message:
    'Your agent "{agentName}" has been successfully registered on the Masumi network. You can view and manage it from your dashboard.',
  button: "View agent",
  footer:
    "You received this email because you registered an AI agent on Masumi. If you did not expect this, you can safely ignore it.",
};

export async function sendAgentRegistrationCompleteEmail(
  userId: string,
  agentId: string,
  agentName: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const viewAgentUrl = `${authEnvConfig.baseUrl}/ai-agents/${agentId}`;

  if (!postmarkClient) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "\n[DEV] Agent registration complete email (Postmark not configured)",
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
      From: emailConfig.postmarkFromEmail,
      To: user.email,
      Tag: "agent-registration-complete",
      Subject: DEFAULT_MESSAGES.title,
      HtmlBody: await reactAgentRegistrationCompleteEmail({
        userName: user.name || "User",
        agentName,
        viewAgentUrl,
        ...DEFAULT_MESSAGES,
      }),
      MessageStream: "outbound",
    });
  } catch (err) {
    console.error("[Postmark] Agent registration complete email failed:", err);
  }
}
