import gridSvg from "@/assets/grid.svg";
import { cn } from "@/lib/utils";

const gridBackgroundUrl =
  typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg;

type GridPageBackgroundProps = {
  className?: string;
  vignette?: boolean;
  /** Default 0.4 — matches auth and error pages. */
  opacity?: number;
  /** Grid drift cycle in seconds. Default 12. */
  animationDurationSeconds?: number;
};

const vignetteMask =
  "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, black 70%)";

export function GridPageBackground({
  className,
  vignette = false,
  opacity = 0.4,
  animationDurationSeconds = 12,
}: GridPageBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 animate-grid-glide",
        className,
      )}
      style={{
        opacity,
        animationDuration: `${animationDurationSeconds}s`,
        backgroundImage: `url(${gridBackgroundUrl})`,
        backgroundRepeat: "repeat",
        backgroundSize: "auto",
        backgroundPosition: "center",
        ...(vignette
          ? {
              maskImage: vignetteMask,
              WebkitMaskImage: vignetteMask,
            }
          : {}),
      }}
    />
  );
}
