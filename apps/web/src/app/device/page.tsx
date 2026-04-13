import type { Metadata } from "next";

import { DeviceCodeForm } from "./components/device-code-form";

export const metadata: Metadata = {
  title: "Masumi - Device Login",
  description: "Approve Masumi CLI device authorization",
};

interface DevicePageProps {
  searchParams: Promise<{ user_code?: string }>;
}

export default async function DevicePage({ searchParams }: DevicePageProps) {
  const { user_code } = await searchParams;

  return <DeviceCodeForm initialUserCode={user_code} />;
}
