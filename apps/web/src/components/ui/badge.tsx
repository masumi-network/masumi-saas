import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-50/80 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50",
        "primary-muted":
          "border-primary/60 bg-primary/20 text-primary hover:bg-primary/30 dark:border-primary/50 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30",
        "secondary-muted":
          "border-secondary/60 bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 dark:border-secondary/50 dark:bg-secondary/20 dark:hover:bg-secondary/30",
        outline: "text-foreground",
        "outline-muted":
          "border-border bg-muted/30 text-foreground hover:bg-muted/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
