import gridSvg from "@/assets/grid.svg";
import { cn } from "@/lib/utils";

const gridBackgroundUrl =
  typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg;

type GridPageBackgroundProps = {
  className?: string;
};

export function GridPageBackground({ className }: GridPageBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 opacity-40 animate-grid-glide",
        className,
      )}
      style={{
        backgroundImage: `url(${gridBackgroundUrl})`,
        backgroundRepeat: "repeat",
        backgroundSize: "auto",
        backgroundPosition: "center",
      }}
    />
  );
}
