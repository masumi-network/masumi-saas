"use client";

import { useEffect,useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Tab {
  name: string;
  count?: number | null;
  key?: string;
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

  useEffect(() => {
    const updateIndicator = () => {
      const activeIndex = tabs.findIndex((tab) => tab.name === activeTab);
      const activeTabElement = tabsRef.current[activeIndex];

      if (activeTabElement) {
        setIndicatorStyle({
          left: activeTabElement.offsetLeft,
          width: activeTabElement.offsetWidth,
        });
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 0);
    return () => clearTimeout(timer);
  }, [activeTab, tabs]);

  return (
    <div className={cn("flex gap-6 border-b relative", className)}>
      <div
        className="absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
      />
      {tabs.map((tab, index) => (
        <button
          key={tab.name}
          ref={(el) => {
            if (el) tabsRef.current[index] = el;
          }}
          onClick={() => onTabChange(tab.name)}
          className={cn(
            "pb-4 relative text-sm transition-colors duration-200",
            activeTab === tab.name ? "text-primary" : "text-muted-foreground",
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
  );
}
