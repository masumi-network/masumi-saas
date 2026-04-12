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
  render,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface VerificationEmailProps {
  name: string;
  verificationLink: string;
  verificationCode?: string;
  logoUrl?: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    button: string;
    linkText: string;
    codeLabel?: string;
    codeExpiry?: string;
    codeHelp?: string;
    footer: string;
  };
}

export const VerificationEmail = ({
  name,
  verificationLink,
  verificationCode,
  logoUrl,
  translations,
}: VerificationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{translations.preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-[20px]">
            {logoUrl ? (
              <Section className="mb-[24px] text-center">
                <Img
                  src={logoUrl}
                  alt="Masumi"
                  width={48}
                  height={48}
                  className="mx-auto rounded-full"
                  style={{ borderRadius: "50%" }}
                />
              </Section>
            ) : null}
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              {translations.title}
            </Heading>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.greeting.replace("{name}", () => name)}
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.message}
            </Text>
            {verificationCode ? (
              <Section className="my-[32px] rounded border border-solid border-[#eaeaea] bg-[#fafafa] px-[16px] py-[20px] text-center">
                <Text className="m-0 text-[12px] uppercase tracking-[0.2em] text-[#666666]">
                  {translations.codeLabel ?? "Verification code"}
                </Text>
                <Text className="m-0 mt-[12px] text-[32px] font-semibold tracking-[0.35em] text-black">
                  {verificationCode}
                </Text>
                {translations.codeExpiry ? (
                  <Text className="m-0 mt-[12px] text-[14px] leading-[24px] text-[#666666]">
                    {translations.codeExpiry}
                  </Text>
                ) : null}
              </Section>
            ) : null}
            {verificationCode && translations.codeHelp ? (
              <Text className="text-[14px] leading-[24px] text-black">
                {translations.codeHelp}
              </Text>
            ) : null}
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={verificationLink}
              >
                {translations.button}
              </Button>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.linkText}{" "}
              <Link
                href={verificationLink}
                className="text-blue-600 no-underline"
              >
                {verificationLink}
              </Link>
            </Text>
            <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
            <Text className="text-[12px] leading-[24px] text-[#666666]">
              {translations.footer}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export async function reactVerificationEmail(props: VerificationEmailProps) {
  return await render(<VerificationEmail {...props} />);
}
