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

interface InvitationEmailProps {
  inviteLink: string;
  organizationName: string;
  inviterName: string;
  role: string;
  logoUrl?: string;
  translations: {
    preview: string;
    title: string;
    greeting: string;
    message: string;
    button: string;
    linkText: string;
    footer: string;
  };
}

export const InvitationEmail = ({
  inviteLink,
  organizationName,
  inviterName,
  role,
  logoUrl,
  translations,
}: InvitationEmailProps) => {
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
              {translations.greeting
                .replace("{inviter}", inviterName)
                .replace("{organization}", organizationName)
                .replace("{role}", role)}
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.message}
            </Text>
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={inviteLink}
              >
                {translations.button}
              </Button>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.linkText}{" "}
              <Link href={inviteLink} className="text-blue-600 no-underline">
                {inviteLink}
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

export async function reactInvitationEmail(props: InvitationEmailProps) {
  return await render(<InvitationEmail {...props} />);
}
