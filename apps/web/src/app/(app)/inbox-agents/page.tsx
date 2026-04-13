import type { Metadata } from "next";

import { InboxAgentsPage } from "./components/inbox-agents-page";

export const metadata: Metadata = {
  title: "Masumi - Inbox agents",
  description: "Manage inbox-agent registrations in Masumi SaaS.",
};

export default function InboxAgentsRoute() {
  return (
    <div className="w-full space-y-8">
      <InboxAgentsPage />
    </div>
  );
}
