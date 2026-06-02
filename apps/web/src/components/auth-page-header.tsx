import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthPageHeaderProps = {
  title: string;
  description?: ReactNode;
  className?: string;
};

export function AuthPageHeader({
  title,
  description,
  className,
}: AuthPageHeaderProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-auth-title font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
