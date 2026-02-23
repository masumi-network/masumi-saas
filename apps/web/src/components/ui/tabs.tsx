"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Tab {
  name: string;
  count?: number | null;
  key?: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabName: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
  });
  const [shouldAnimate, setShouldAnimate] = useState(false);

  const getTabValue = (tab: Tab) => tab.key ?? tab.name;

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = tabs.findIndex(
        (tab) => getTabValue(tab) === activeTab && !tab.disabled,
      );
      const activeTabElement = tabsRef.current[activeIndex];

      if (activeTabElement) {
        setIndicatorStyle({
          left: activeTabElement.offsetLeft,
          width: activeTabElement.offsetWidth,
        });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setShouldAnimate(true));
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 0);
    return () => clearTimeout(timer);
  }, [activeTab, tabs]);

  return (
    <div className={cn("w-full min-w-0 -mx-px", className)}>
      <div className="overflow-x-auto overflow-y-hidden flex gap-6 border-b relative flex-nowrap">
        <div
          className={cn(
            "absolute bottom-0 h-0.5 bg-primary ease-out",
            shouldAnimate && "transition-all duration-300",
          )}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
        {tabs.map((tab, index) => (
          <button
            key={getTabValue(tab)}
            ref={(el) => {
              if (el) tabsRef.current[index] = el;
            }}
            type="button"
            onClick={() => !tab.disabled && onTabChange(getTabValue(tab))}
            disabled={tab.disabled}
            className={cn(
              "pb-4 relative text-sm transition-colors duration-200 whitespace-nowrap shrink-0",
              getTabValue(tab) === activeTab
                ? "text-primary"
                : "text-muted-foreground",
              tab.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              {tab.name}
              {tab.count !== null && tab.count !== undefined && (
                <span className="bg-destructive text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
