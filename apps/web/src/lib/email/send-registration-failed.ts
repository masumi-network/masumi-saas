import prisma from "@masumi/database/client";

import { authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig } from "@/lib/config/email.config";
import { reactAgentRegistrationFailedEmail } from "@/lib/email/agent-registration-failed";
import { postmarkClient } from "@/lib/email/postmark";

const DEFAULT_MESSAGES = {
  preview: "Agent registration did not complete on the Masumi network",
  title: "Agent registration failed",
  greeting: "Hi {name},",
  message:
    'Registration for your agent "{agentName}" could not be completed on the Masumi network. You can view the agent and try again from your dashboard.',
  errorLabel: "Reason",
  button: "View agent",
  footer:
    "You received this email because you started an agent registration on Masumi. If you did not expect this, you can safely ignore it.",
};

export async function sendAgentRegistrationFailedEmail(
  userId: string,
  agentId: string,
  agentName: string,
  errorMessage?: string,
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
        "\n[DEV] Agent registration failed email (Postmark not configured)",
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`To: ${user.email}`);
      console.log(`Agent: ${agentName}`);
      console.log(`Error: ${errorMessage ?? "(none)"}`);
      console.log(`View: ${viewAgentUrl}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }
    return;
  }

  try {
    await postmarkClient.sendEmail({
      From: emailConfig.postmarkFromEmail,
      To: user.email,
      Tag: "agent-registration-failed",
      Subject: DEFAULT_MESSAGES.title,
      HtmlBody: await reactAgentRegistrationFailedEmail({
        userName: user.name || "User",
        agentName,
        viewAgentUrl,
        errorMessage: errorMessage ?? undefined,
        ...DEFAULT_MESSAGES,
      }),
      MessageStream: "outbound",
    });
  } catch (err) {
    console.error("[Postmark] Agent registration failed email failed:", err);
  }
}
