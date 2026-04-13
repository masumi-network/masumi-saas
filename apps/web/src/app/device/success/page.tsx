import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masumi - Device Approved",
  description: "Masumi CLI device authorization approved",
};

const copy = {
  badge: "OIDC",
  title: "Device authorized",
  description:
    "Your CLI device authorization request has been approved successfully.",
  detail: "You can return to your CLI and close this tab.",
} as const;

export default function DeviceSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{copy.badge}</Badge>
          </div>
          <CardTitle className="text-3xl font-light tracking-tight">
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{copy.detail}</p>
        </CardContent>
      </Card>
    </main>
  );
}
