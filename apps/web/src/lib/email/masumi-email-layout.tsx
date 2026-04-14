import {
  Body,
  Button,
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

import { emailConfig } from "../config/email.config";

type MasumiEmailLayoutProps = {
  preview: string;
  title: string;
  footer: string;
  children: ReactNode;
  greeting?: string;
  logoUrl?: string;
  footerLinks?: Array<{ label: string; href: string }>;
};

type MasumiEmailCodeBlockProps = {
  label: string;
  code: string;
  helperText?: string;
};

type MasumiEmailNoticeBlockProps = {
  label: string;
  message: string;
  tone?: "neutral" | "success" | "danger";
};

type MasumiEmailDetailBlockProps = {
  label: string;
  value: string;
};

const NOTICE_STYLES = {
  neutral: {
    borderColor: "#e6e6e6",
    backgroundColor: "#f7f7f7",
    labelColor: "#737373",
    textColor: "#0a0a0a",
  },
  success: {
    borderColor: "#d1fae5",
    backgroundColor: "#f0fdf4",
    labelColor: "#16a34a",
    textColor: "#14532d",
  },
  danger: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    labelColor: "#c70000",
    textColor: "#7f1d1d",
  },
} as const;

const BRAND_NAME = "Masumi";

const DEFAULT_FOOTER_LINKS = [
  { label: "Website", href: "https://masumi.network" },
  { label: "Support", href: "https://masumi.network/support" },
];

export function MasumiEmailLayout({
  preview,
  title,
  footer,
  children,
  greeting,
  logoUrl,
  footerLinks = DEFAULT_FOOTER_LINKS,
}: MasumiEmailLayoutProps) {
  const resolvedLogoUrl = logoUrl?.trim() || emailConfig.brandLogoUrl;

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
                  alt="Masumi"
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
                  <Text
                    className="m-0 text-[11px] font-semibold uppercase text-[#ff51ff]"
                    style={{ letterSpacing: "0.2em" }}
                  >
                    {BRAND_NAME}
                  </Text>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function MasumiEmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 text-[15px] leading-[26px] text-[#404040]">
      {children}
    </Text>
  );
}

export function MasumiEmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section className="my-[28px] text-center">
      <Button
        className="rounded-[8px] px-[28px] py-[12px] text-[14px] font-medium text-black no-underline"
        href={href}
        style={{
          backgroundColor: "#ff51ff",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

export function MasumiEmailCodeBlock({
  label,
  code,
  helperText,
}: MasumiEmailCodeBlockProps) {
  return (
    <Section className="my-[28px] rounded-[8px] border border-solid border-[#e6e6e6] bg-[#f7f7f7] px-[20px] py-[24px] text-center">
      <Text
        className="m-0 text-[11px] font-medium uppercase text-[#737373]"
        style={{ letterSpacing: "0.2em" }}
      >
        {label}
      </Text>
      <Text
        className="m-0 mt-[14px] text-[34px] font-semibold text-[#0a0a0a]"
        style={{ letterSpacing: "0.3em" }}
      >
        {code}
      </Text>
      {helperText ? (
        <Text className="m-0 mt-[14px] text-[13px] leading-[22px] text-[#737373]">
          {helperText}
        </Text>
      ) : null}
    </Section>
  );
}

export function MasumiEmailNoticeBlock({
  label,
  message,
  tone = "neutral",
}: MasumiEmailNoticeBlockProps) {
  const noticeStyle = NOTICE_STYLES[tone];

  return (
    <Section
      className="my-[22px] rounded-[8px] border border-solid px-[16px] py-[16px]"
      style={{
        borderColor: noticeStyle.borderColor,
        backgroundColor: noticeStyle.backgroundColor,
      }}
    >
      <Text
        className="m-0 text-[11px] font-semibold uppercase"
        style={{
          color: noticeStyle.labelColor,
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </Text>
      <Text
        className="m-0 mt-[8px] text-[13px] leading-[22px]"
        style={{ color: noticeStyle.textColor }}
      >
        {message}
      </Text>
    </Section>
  );
}

export function MasumiEmailDetailBlock({
  label,
  value,
}: MasumiEmailDetailBlockProps) {
  return (
    <Section className="my-[22px] rounded-[8px] border border-solid border-[#e6e6e6] bg-[#f7f7f7] px-[16px] py-[16px]">
      <Text
        className="m-0 text-[11px] font-medium uppercase text-[#737373]"
        style={{ letterSpacing: "0.16em" }}
      >
        {label}
      </Text>
      <Text className="m-0 mt-[8px] text-[16px] font-semibold leading-[24px] text-[#0a0a0a]">
        {value}
      </Text>
    </Section>
  );
}
