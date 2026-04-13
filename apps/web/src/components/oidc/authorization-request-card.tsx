import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthorizationRequestCardProps = {
  protocolBadge: string;
  clientLabel: string;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
};

export function AuthorizationRequestCard({
  protocolBadge,
  clientLabel,
  title,
  description,
  children,
  footer,
  cardClassName,
  contentClassName,
}: AuthorizationRequestCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <Card className={cn("w-full max-w-2xl", cardClassName)}>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{protocolBadge}</Badge>
            <Badge variant="outline">{clientLabel}</Badge>
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className={cn("space-y-4", contentClassName)}>
          {children}
        </CardContent>
        {footer ? <CardFooter>{footer}</CardFooter> : null}
      </Card>
    </main>
  );
}
