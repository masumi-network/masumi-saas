"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DiscoveryDetailsDialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogContent
      className={cn(
        "flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
        className,
      )}
    >
      {children}
    </DialogContent>
  );
}

export function DiscoveryDetailsHeader({
  avatar,
  title,
  status,
  description,
  meta,
}: {
  avatar: ReactNode;
  title: string;
  status?: ReactNode;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <DialogHeader className="shrink-0 border-b px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start gap-3 pr-8 sm:gap-4">
        {avatar}
        <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
            {status}
          </div>
          <DialogDescription className="line-clamp-3 text-sm leading-relaxed">
            {description}
          </DialogDescription>
          {meta ? (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">{meta}</div>
          ) : null}
        </div>
      </div>
    </DialogHeader>
  );
}

export function DiscoveryDetailsAvatar({
  name,
  image,
  fallback,
}: {
  name: string;
  image?: string | null;
  fallback: string;
}) {
  return (
    <Avatar className="h-12 w-12 shrink-0 border border-border/70 sm:h-14 sm:w-14">
      {image ? <AvatarImage src={image} alt={name} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

export function DiscoveryDetailsBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogBody
      stagger={false}
      className={cn(
        "space-y-4 overflow-x-hidden px-5 py-4 sm:space-y-5 sm:px-6 sm:py-5",
        className,
      )}
    >
      {children}
    </DialogBody>
  );
}

export function DiscoveryDetailCard({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {title ? (
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-muted-surface/30">
        {children}
      </div>
    </section>
  );
}

export function DiscoveryDetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-4">
      <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function DiscoveryDetailStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function DiscoveryDetailStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted-surface/30 px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function DiscoveryCopyableValue({
  value,
  mono = true,
}: {
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-1">
      <span
        className={cn(
          "min-w-0 flex-1 break-all leading-relaxed",
          mono ? "font-mono text-xs sm:text-sm" : "text-sm",
        )}
      >
        {value}
      </span>
      <CopyButton value={value} className="h-7 w-7 shrink-0" />
    </div>
  );
}

export function DiscoveryMutedValue({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export function DiscoveryLinkValue({
  href,
  openLabel,
}: {
  href: string;
  openLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 break-all text-sm text-foreground hover:underline"
      >
        {href}
      </Link>
      <div className="flex shrink-0 items-center gap-1 self-start sm:self-center">
        <CopyButton value={href} className="h-7 w-7" />
        <Button asChild variant="outline" size="sm2">
          <Link href={href} target="_blank" rel="noreferrer">
            {openLabel}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function DiscoveryDetailCardContent({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="px-4 py-3">{children}</div>;
}

export function DiscoveryMetaBadge({
  children,
  variant = "outline-muted",
}: {
  children: ReactNode;
  variant?: React.ComponentProps<typeof Badge>["variant"];
}) {
  return (
    <Badge variant={variant} className="max-w-full truncate">
      {children}
    </Badge>
  );
}
