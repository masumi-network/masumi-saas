"use client";

import { Link2 } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";
import { getEvmChainIconPath } from "@/lib/x402/evm-config";

type ChainIconProps = {
  caip2Id: string;
  name?: string;
  size?: number;
  className?: string;
};

export function ChainIcon({
  caip2Id,
  name,
  size = 20,
  className,
}: ChainIconProps) {
  const src = getEvmChainIconPath(caip2Id);
  const [loadError, setLoadError] = useState(false);

  if (!src || loadError) {
    return (
      <Link2
        className={cn("shrink-0 text-muted-foreground", className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <Image
      src={src}
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
  suffix,
  trailing,
  iconSize = 16,
  className,
}: {
  caip2Id: string;
  name: string;
  suffix?: ReactNode;
  trailing?: ReactNode;
  iconSize?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <ChainIcon caip2Id={caip2Id} name={name} size={iconSize} />
      <span className="min-w-0 truncate">
        {name}
        {suffix}
      </span>
      {trailing}
    </div>
  );
}
