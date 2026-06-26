import { X402Logo } from "@/components/x402/x402-logo";

type X402PageTitleProps = {
  /** Accessible label when the logo replaces visible text. */
  label?: string;
};

export function X402PageTitle({ label = "x402" }: X402PageTitleProps) {
  return (
    <span className="inline-flex items-center leading-none">
      <span className="sr-only">{label}</span>
      <X402Logo className="h-10 sm:h-11" />
    </span>
  );
}
