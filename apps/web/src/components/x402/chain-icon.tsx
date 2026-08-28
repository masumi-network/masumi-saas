"use client";

import { Link2 } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";
import { resolveChainIconSource } from "@/lib/x402/evm-config";

type ChainIconProps = {
  caip2Id: string;
  name?: string;
  iconSlug?: string | null;
  size?: number;
  className?: string;
};

export function ChainIcon({
  caip2Id,
  name,
  iconSlug,
  size = 20,
  className,
}: ChainIconProps) {
  const iconSource = resolveChainIconSource(caip2Id, iconSlug, name);
  const [loadError, setLoadError] = useState(false);

  if (!iconSource || loadError) {
    return (
      <Link2
        className={cn("shrink-0 text-muted-foreground", className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  if (iconSource.remote) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote chainlist icons vary by host/format
      <img
        src={iconSource.src}
        alt={name ? `${name} icon` : ""}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-contain", className)}
        aria-hidden={!name}
        onError={() => setLoadError(true)}
      />
    );
  }

  return (
    <Image
      src={iconSource.src}
      alt={name ? `${name} icon` : ""}
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0 rounded-full object-contain", className)}
      aria-hidden={!name}
      onError={() => setLoadError(true)}
    />
  );
}

export function ChainLabel({
  caip2Id,
  name,
  iconSlug,
  suffix,
  trailing,
  iconSize = 16,
  className,
}: {
  caip2Id: string;
  name: string;
  iconSlug?: string | null;
  suffix?: ReactNode;
  trailing?: ReactNode;
  iconSize?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <ChainIcon
        caip2Id={caip2Id}
        name={name}
        iconSlug={iconSlug}
        size={iconSize}
      />
      <span className="min-w-0 truncate">
        {name}
        {suffix}
      </span>
      {trailing}
    </div>
  );
}
