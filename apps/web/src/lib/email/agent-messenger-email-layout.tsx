import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { emailConfig } from "@/lib/config/email.config";

type AgentMessengerEmailLayoutProps = {
  preview: string;
  title: string;
  footer: string;
  children: ReactNode;
  greeting?: string;
  logoUrl?: string;
  footerLinks?: Array<{ label: string; href: string }>;
  poweredByLogoUrl?: string;
};

const DEFAULT_FOOTER_LINKS = [
  { label: "Website", href: "https://masumi.network" },
  { label: "Support", href: "https://masumi.network/support" },
];

export function AgentMessengerEmailLayout({
  preview,
  title,
  footer,
  children,
  greeting,
  logoUrl,
  footerLinks = DEFAULT_FOOTER_LINKS,
  poweredByLogoUrl,
}: AgentMessengerEmailLayoutProps) {
  const resolvedLogoUrl = logoUrl?.trim() || emailConfig.brandLogoUrl;
  const resolvedPoweredByLogoUrl =
    poweredByLogoUrl?.trim() || emailConfig.brandLogoUrl;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#f5f5f5] px-3 py-6 font-sans text-[#0a0a0a]">
          <Container className="mx-auto my-[32px] max-w-[560px]">
            <Section
              className="overflow-hidden rounded-[12px] border border-solid border-[#e6e6e6] bg-white"
              style={{
                boxShadow:
                  "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
              }}
            >
              <Section
                className="px-[32px] py-[28px] text-center"
                style={{ backgroundColor: "#0a0a0a" }}
              >
                <Img
                  src={resolvedLogoUrl}
                  alt="Agent Messenger"
                  width={44}
                  height={44}
                  className="mx-auto"
                  style={{ borderRadius: "10px" }}
                />
                <Heading className="mx-0 mt-[20px] text-[24px] font-light leading-[32px] text-white">
                  {title}
                </Heading>
              </Section>

              <Section className="px-[32px] py-[32px]">
                {greeting ? (
                  <Text className="m-0 text-[16px] font-medium leading-[26px] text-[#0a0a0a]">
                    {greeting}
                  </Text>
                ) : null}
                <Section className={greeting ? "mt-[16px]" : undefined}>
                  {children}
                </Section>
                <Hr className="mx-0 my-[28px] w-full border border-solid border-[#e6e6e6]" />

                {footerLinks && footerLinks.length > 0 ? (
                  <Text className="m-0 mb-[14px] text-center text-[12px] leading-[20px] text-[#737373]">
                    {footerLinks.map((link, i) => (
                      <span key={link.href}>
                        {i > 0 ? (
                          <span style={{ margin: "0 8px", color: "#d4d4d4" }}>
                            {"\u00b7"}
                          </span>
                        ) : null}
                        <Link
                          href={link.href}
                          className="text-[#0a0a0a] no-underline"
                          style={{ fontWeight: 500 }}
                        >
                          {link.label}
                        </Link>
                      </span>
                    ))}
                  </Text>
                ) : null}

                <Text className="m-0 text-center text-[12px] leading-[20px] text-[#737373]">
                  {footer}
                </Text>

                <Section className="mt-[18px] text-center">
                  <Hr
                    className="mx-auto mb-[12px] border border-solid border-[#e6e6e6]"
                    style={{ width: "40px" }}
                  />
                  <Text className="m-0 text-[11px] leading-[18px] text-[#737373]">
                    {"Powered by Masumi"}
                  </Text>
                  <Img
                    src={resolvedPoweredByLogoUrl}
                    alt="Masumi"
                    width={18}
                    height={18}
                    className="mx-auto mt-[8px]"
                    style={{ borderRadius: "4px" }}
                  />
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
