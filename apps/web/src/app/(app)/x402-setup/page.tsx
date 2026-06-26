import { redirect } from "next/navigation";

type X402SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function X402SetupPage({
  searchParams,
}: X402SetupPageProps) {
  const params = await searchParams;
  const next = new URLSearchParams();
  next.set("setup", "1");

  const network = params.network;
  if (typeof network === "string") {
    next.set("network", network);
  }

  redirect(`/x402?${next.toString()}`);
}
