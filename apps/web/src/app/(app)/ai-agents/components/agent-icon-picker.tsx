"use client";

import { ChevronLeft, ChevronRight, CircleHelp, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AGENT_ICON_PRESET_KEYS,
  AGENT_ICON_PRESETS,
  isIconUrl,
  isPresetIconKey,
} from "@/lib/constants/agent-icons";
import { cn } from "@/lib/utils";

export interface AgentIconPickerTranslations {
  icon: string;
  iconTooltip: string;
  iconDescription: string;
  iconCustomUrlPlaceholder: string;
  scrollLeft: string;
  scrollRight: string;
  iconClear: string;
}

export interface AgentIconPickerProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onClearError?: () => void;
  onClearIcon?: () => void;
  translations: AgentIconPickerTranslations;
  disabled?: boolean;
}

export function AgentIconPicker({
  value,
  onChange,
  onClearError,
  onClearIcon,
  translations: t,
  disabled = false,
}: AgentIconPickerProps) {
  const iconScrollRef = useRef<HTMLDivElement>(null);
  const [showGradients, setShowGradients] = useState({
    left: false,
    right: true,
  });

  const updateIconScrollGradients = useCallback(() => {
    const el = iconScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth;
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft >= scrollWidth - clientWidth - 1;
    setShowGradients({
      left: hasOverflow && !atStart,
      right: hasOverflow && !atEnd,
    });
  }, []);

  useEffect(() => {
    const el = iconScrollRef.current;
    if (!el) return;
    const runUpdate = () => updateIconScrollGradients();
    runUpdate();
    requestAnimationFrame(runUpdate);
    const ro = new ResizeObserver(runUpdate);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateIconScrollGradients]);

  const scrollIcons = useCallback((direction: "left" | "right") => {
    const el = iconScrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  const handlePresetClick = (key: string) => {
    onClearError?.();
    const isSelected = value === key;
    onChange(isSelected ? undefined : key);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    onClearError?.();
    onChange(v || undefined);
  };

  const handleClearIcon = () => {
    onClearError?.();
    onClearIcon?.();
    onChange("bot");
  };

  return (
    <FormItem>
      <div className="flex items-center gap-2 mb-3">
        <FormLabel className="text-base font-medium">{t.icon}</FormLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
              <CircleHelp className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t.iconTooltip}</TooltipContent>
        </Tooltip>
      </div>
      <FormControl>
        <Card className="min-w-0 overflow-hidden border-border/80 bg-muted-surface">
          <CardContent className="min-w-0 space-y-4">
            <p className="text-muted-foreground text-sm">{t.iconDescription}</p>
            <div className="relative -mx-1">
              <div
                className={cn(
                  "absolute left-0 top-0 z-10 flex h-11 w-48 shrink-0 items-center transition-opacity duration-200 pointer-events-none",
                  showGradients.left ? "opacity-100" : "opacity-0",
                  "[-webkit-transform:translate3d(0,0,0)] [transform:translate3d(0,0,0)]",
                )}
                style={{
                  WebkitTransform: "translate3d(0, 0, 0)",
                  transform: "translate3d(0, 0, 0)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-muted-surface to-transparent"
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto relative -ml-2 hidden h-8 w-8 shrink-0 rounded-full bg-transparent hover:bg-transparent md:inline-flex"
                  onClick={() => scrollIcons("left")}
                  aria-label={t.scrollLeft}
                  disabled={disabled}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div
                className={cn(
                  "absolute right-0 top-0 z-10 flex h-11 w-48 shrink-0 items-center justify-end transition-opacity duration-200 pointer-events-none",
                  showGradients.right ? "opacity-100" : "opacity-0",
                  "[-webkit-transform:translate3d(0,0,0)] [transform:translate3d(0,0,0)]",
                )}
                style={{
                  WebkitTransform: "translate3d(0, 0, 0)",
                  transform: "translate3d(0, 0, 0)",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-l from-muted-surface to-transparent"
                  aria-hidden
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto relative -mr-2 hidden h-8 w-8 shrink-0 rounded-full bg-transparent hover:bg-transparent md:inline-flex"
                  onClick={() => scrollIcons("right")}
                  aria-label={t.scrollRight}
                  disabled={disabled}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div
                ref={iconScrollRef}
                onScroll={updateIconScrollGradients}
                className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto scrollbar-hide px-1 pb-2 [-webkit-overflow-scrolling:touch] relative z-1"
              >
                {AGENT_ICON_PRESET_KEYS.map((key) => {
                  const IconComponent = AGENT_ICON_PRESETS[key];
                  const isSelected = value === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePresetClick(key)}
                      disabled={disabled}
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary shadow-md"
                          : "border bg-background hover:bg-muted hover:border-muted-foreground/20",
                      )}
                    >
                      <IconComponent className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 flex items-center">
                <Link2 className="text-muted-foreground absolute left-3 h-4 w-4" />
                <Input
                  placeholder={t.iconCustomUrlPlaceholder}
                  value={value && !isPresetIconKey(value) ? value : ""}
                  onChange={handleUrlChange}
                  className="pl-9 bg-background"
                  disabled={disabled}
                />
              </div>
              {value && isIconUrl(value) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearIcon}
                  disabled={disabled}
                >
                  {t.iconClear}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
