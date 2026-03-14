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

const LOGO_URL = "https://avatars.githubusercontent.com/u/194367856?s=200&v=4";

interface AgentRegistrationCompleteEmailProps {
  userName: string;
  agentName: string;
  viewAgentUrl: string;
  preview: string;
  title: string;
  greeting: string;
  message: string;
  button: string;
  footer: string;
}

export const AgentRegistrationCompleteEmail = ({
  userName,
  agentName,
  viewAgentUrl,
  preview,
  title,
  greeting,
  message,
  button,
  footer,
}: AgentRegistrationCompleteEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-[20px]">
            <Section className="mb-[24px] text-center">
              <Img
                src={LOGO_URL}
                alt="Masumi"
                width={48}
                height={48}
                className="mx-auto rounded-full"
                style={{ borderRadius: "50%" }}
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              {title}
            </Heading>
            <Text className="text-[14px] leading-[24px] text-black">
              {greeting.replace("{name}", userName)}
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              {message.replace("{agentName}", agentName)}
            </Text>
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={viewAgentUrl}
              >
                {button}
              </Button>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              <Link href={viewAgentUrl} className="text-blue-600 no-underline">
                {viewAgentUrl}
              </Link>
            </Text>
            <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
            <Text className="text-[12px] leading-[24px] text-[#666666]">
              {footer}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export async function reactAgentRegistrationCompleteEmail(
  props: AgentRegistrationCompleteEmailProps,
) {
  return await render(<AgentRegistrationCompleteEmail {...props} />);
}
