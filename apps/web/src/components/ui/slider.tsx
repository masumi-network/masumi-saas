"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  Omit<
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    "children"
  > & { thumbClassName?: string }
>(({ className, thumbClassName, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex touch-none select-none items-center data-[orientation=horizontal]:cursor-grab data-[orientation=horizontal]:active:cursor-grabbing",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block size-5 rounded-full border border-border bg-background shadow-sm transition-colors hover:border-muted-foreground/50",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/55",
        "disabled:pointer-events-none disabled:opacity-40",
        thumbClassName,
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
