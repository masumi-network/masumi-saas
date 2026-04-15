import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContextWithHeaders } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Masumi",
  };
}

export default async function VerificationPage() {
  const { user, session } = await getAuthContextWithHeaders();

  if (!user || !session) {
    redirect("/signin");
  }
  redirect("/");
}
