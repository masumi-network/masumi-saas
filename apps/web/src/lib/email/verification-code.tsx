import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  render,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface VerificationCodeEmailProps {
  name: string;
  otpCode: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    codeLabel: string;
    expiry: string;
    footer: string;
  };
}

export const VerificationCodeEmail = ({
  name,
  otpCode,
  translations,
}: VerificationCodeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{translations.preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-[20px]">
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              {translations.title}
            </Heading>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.greeting.replace("{name}", () => name)}
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.message}
            </Text>
            <Section className="my-[32px] rounded border border-solid border-[#eaeaea] bg-[#fafafa] px-[16px] py-[20px] text-center">
              <Text className="m-0 text-[12px] uppercase tracking-[0.2em] text-[#666666]">
                {translations.codeLabel}
              </Text>
              <Text className="m-0 mt-[12px] text-[32px] font-semibold tracking-[0.35em] text-black">
                {otpCode}
              </Text>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.expiry}
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

export async function reactVerificationCodeEmail(
  props: VerificationCodeEmailProps,
) {
  return await render(<VerificationCodeEmail {...props} />);
}
