import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from "@react-email/components";

interface MagicLinkEmailProps {
  name: string;
  magicLink: string;
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

export const MagicLinkEmail = ({
  name,
  magicLink,
  translations,
}: MagicLinkEmailProps) => {
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
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={magicLink}
              >
                {translations.button}
              </Button>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              {translations.linkText}{" "}
              <Link href={magicLink} className="text-blue-600 no-underline">
                {magicLink}
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

export async function reactMagicLinkEmail(props: MagicLinkEmailProps) {
  return await render(<MagicLinkEmail {...props} />);
}
