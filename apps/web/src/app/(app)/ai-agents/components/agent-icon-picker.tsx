"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormControl, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AGENT_ICON_PRESETS,
  formatAgentIconLabel,
  isPresetIconKey,
  searchAgentIconKeys,
} from "@/lib/constants/agent-icons";
import { cn } from "@/lib/utils";

export interface AgentIconPickerTranslations {
  iconDescription: string;
  iconSearchPlaceholder: string;
  iconSearchEmpty: string;
  scrollLeft: string;
  scrollRight: string;
}

export interface AgentIconPickerProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onClearError?: () => void;
  translations: AgentIconPickerTranslations;
  disabled?: boolean;
}

export function AgentIconPicker({
  value,
  onChange,
  onClearError,
  translations: t,
  disabled = false,
}: AgentIconPickerProps) {
  const iconScrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGradients, setShowGradients] = useState({
    left: false,
    right: true,
  });

  const filteredKeys = useMemo(
    () => searchAgentIconKeys(searchQuery),
    [searchQuery],
  );

  const selectedKey = isPresetIconKey(value) ? value : undefined;

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
  }, [updateIconScrollGradients, filteredKeys.length]);

  useEffect(() => {
    if (!selectedKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear filter when selection changes externally (e.g. autofill).
    setSearchQuery((current) => {
      if (searchAgentIconKeys(current).includes(selectedKey)) return current;
      return "";
    });
  }, [selectedKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const frame = requestAnimationFrame(() => {
      const scroller = iconScrollRef.current;
      if (!scroller) return;
      const button = scroller.querySelector<HTMLElement>(
        `[data-agent-icon-key="${selectedKey}"]`,
      );
      button?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
      updateIconScrollGradients();
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedKey, searchQuery, updateIconScrollGradients]);

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
    const isSelected = selectedKey === key;
    onChange(isSelected ? undefined : key);
  };

  return (
    <FormItem className="gap-1.5">
      <FormControl>
        <Card className="min-w-0 overflow-hidden border-border/80 bg-muted-surface">
          <CardContent className="min-w-0 space-y-4">
            <p className="text-muted-foreground text-sm">{t.iconDescription}</p>
            <div className="relative flex items-center">
              <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
              <Input
                placeholder={t.iconSearchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
                disabled={disabled}
              />
            </div>
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
              {filteredKeys.length === 0 ? (
                <p className="px-1 pb-2 text-sm text-muted-foreground">
                  {t.iconSearchEmpty}
                </p>
              ) : (
                <div
                  ref={iconScrollRef}
                  onScroll={updateIconScrollGradients}
                  className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto scrollbar-hide px-1 pb-2 [-webkit-overflow-scrolling:touch] relative z-1"
                >
                  {filteredKeys.map((key) => {
                    const IconComponent = AGENT_ICON_PRESETS[key];
                    const isSelected = selectedKey === key;
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            data-agent-icon-key={key}
                            onClick={() => handlePresetClick(key)}
                            disabled={disabled}
                            aria-label={formatAgentIconLabel(key)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-[background-color,border-color,box-shadow,color] duration-200",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary shadow-md"
                                : "border bg-background hover:bg-muted hover:border-muted-foreground/20",
                            )}
                          >
                            <IconComponent className="h-5 w-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {formatAgentIconLabel(key)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
