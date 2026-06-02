import { describe, expect, it } from "vitest";

import { reactAgentMessengerMagicLinkEmail } from "./agent-messenger-magic-link";

describe("reactAgentMessengerMagicLinkEmail", () => {
  it("renders separate header and powered-by logo URLs", async () => {
    const headerLogoUrl = "https://example.com/agent-messenger-logo.png";
    const poweredByLogoUrl = "https://example.com/masumi-logo.png";

    const html = await reactAgentMessengerMagicLinkEmail({
      name: "OIDC User",
      magicLink: "https://example.com/magic",
      magicCode: "123456",
      logoUrl: headerLogoUrl,
      poweredByLogoUrl,
      translations: {
        preview: "Your Agent Messenger access link",
        title: "Continue to Agent Messenger",
        greeting: "Hello {name},",
        message:
          "Use the button below to continue to Agent Messenger. If you prefer, you can use the code shown below instead.",
        consentBefore:
          "If this is your first time here, using this link means you agree to our ",
        consentPrivacyLabel: "Privacy Policy",
        consentAfter: ".",
        button: "Continue to Agent Messenger",
        codeLabel: "Access code",
        codeExpiry: "This code expires in 15 minutes.",
        codeHelp:
          "You can enter this code in Agent Messenger if you prefer not to open the link.",
        footer: "If you didn't request this email, you can safely ignore it.",
      },
    });

    expect(html).toContain(headerLogoUrl);
    expect(html).toContain(poweredByLogoUrl);
    expect(html).toContain("Powered by Masumi");
  });
});
