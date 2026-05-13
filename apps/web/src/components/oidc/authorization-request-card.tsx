import { Shield } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AuthorizationRequestCardProps = {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
};

export function AuthorizationRequestCard({
  title,
  description,
  children,
  footer,
  icon,
  cardClassName,
  contentClassName,
}: AuthorizationRequestCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Card
        className={cn(
          "w-full max-w-lg animate-page-in overflow-hidden gap-0 pt-0",
          cardClassName,
        )}
      >
        <CardHeader className="items-center space-y-3 rounded-t-xl border-b border-border/50 bg-masumi-gradient pt-8 text-center">
          <div className="animate-scale-in flex h-12 w-12 items-center justify-center justify-self-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            {icon ?? <Shield className="h-6 w-6 text-primary" />}
          </div>
          <CardTitle className="justify-self-center text-lg">{title}</CardTitle>
          <CardDescription className="justify-self-center">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className={cn("space-y-6 pb-6 pt-4", contentClassName)}>
          {children}
        </CardContent>
        {footer ? (
          <>
            <div className="px-6">
              <Separator />
            </div>
            <CardFooter className="flex-col gap-4 pt-4">{footer}</CardFooter>
          </>
        ) : null}
      </Card>
    </main>
  );
}
