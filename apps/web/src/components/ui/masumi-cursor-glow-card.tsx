"use client";

import {
  type ComponentProps,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MasumiCursorGlowCardProps = ComponentProps<typeof Card>;

export function MasumiCursorGlowCard({
  className,
  children,
  onPointerMove,
  onPointerLeave,
  style,
  ...props
}: MasumiCursorGlowCardProps) {
  const [glowX, setGlowX] = useState(50);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const updateGlowFromClientX = useCallback(
    (clientX: number, width: number, left: number) => {
      if (width <= 0) return;
      const pct = ((clientX - left) / width) * 100;
      setGlowX(Math.min(100, Math.max(0, pct)));
    },
    [],
  );

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (reducedMotionRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    updateGlowFromClientX(event.clientX, rect.width, rect.left);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    setGlowX(50);
  };

  const glowStyle = {
    ...style,
    "--masumi-glow-x": `${glowX}%`,
  } as CSSProperties;

  return (
    <Card
      className={cn("relative overflow-hidden", className)}
      style={glowStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...props}
    >
      <div
        aria-hidden
        className="masumi-card-cursor-glow pointer-events-none absolute inset-0 z-0"
      />
      <div className="relative z-[1] flex min-h-0 flex-col">{children}</div>
    </Card>
  );
}
