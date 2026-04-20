import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masumi - Device Approved",
  description: "Masumi Agent Messenger CLI device authorization approved",
};

const copy = {
  title: "Device authorized",
  description:
    "Your Agent Messenger CLI authorization has been approved successfully.",
  detail: "You can return to your terminal and close this tab.",
} as const;

export default function DeviceSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm animate-page-in text-center">
        <CardHeader className="items-center space-y-4">
          <div className="justify-self-center rounded-full bg-green-500/10 p-4">
            <CheckCircle2 className="h-12 w-12 animate-check-in text-green-500" />
          </div>
          <CardTitle className="justify-self-center text-2xl font-semibold">
            {copy.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-base text-muted-foreground">{copy.description}</p>
          <p className="text-sm text-muted-foreground">{copy.detail}</p>
        </CardContent>
      </Card>
    </main>
  );
}
