"use client";

import { Bot, HelpCircle } from "lucide-react";
import { useState } from "react";

import {
  AGENT_ICON_PRESETS,
  isIconUrl,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";
import { cn } from "@/lib/utils";

interface AgentIconProps {
  icon: string | null | undefined;
  name: string;
  className?: string;
  isMuted?: boolean;
  onLoadError?: (url: string) => void;
}

function AgentIconImage({
  icon,
  name,
  className,
  isMuted,
  onLoadError,
}: {
  icon: string;
  name: string;
  className?: string;
  isMuted?: boolean;
  onLoadError?: (url: string) => void;
}) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <HelpCircle
        className={cn(
          "size-8 shrink-0 text-destructive",
          className,
          isMuted && "opacity-60",
        )}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={icon}
      alt={`${name} icon`}
      className={cn(
        "shrink-0 size-8 rounded-lg object-contain",
        className,
        isMuted && "opacity-60",
      )}
      onError={() => {
        setLoadError(true);
        onLoadError?.(icon);
      }}
    />
  );
}

export function AgentIcon({
  icon,
  name,
  className,
  isMuted,
  onLoadError,
}: AgentIconProps) {
  if (icon && isIconUrl(icon)) {
    return (
      <AgentIconImage
        key={icon}
        icon={icon}
        name={name}
        className={className}
        isMuted={isMuted}
        onLoadError={onLoadError}
      />
    );
  }

  if (icon && isPresetIconKey(icon)) {
    const IconComponent = AGENT_ICON_PRESETS[icon];
    if (IconComponent) {
      return (
        <IconComponent
          className={cn(
            "size-8 shrink-0",
            className,
            isMuted && "opacity-60 text-muted-foreground",
          )}
          aria-hidden
        />
      );
    }
  }

  return (
    <Bot
      className={cn(
        "size-8 shrink-0 text-muted-foreground",
        className,
        isMuted && "opacity-60",
      )}
      aria-hidden
    />
  );
}
