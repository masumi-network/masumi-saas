"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useTranslations } from "next-intl";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils/index";

export const OTP_CODE_LENGTH = 6;

export function normalizeOtpDigits(
  value: string,
  length = OTP_CODE_LENGTH,
): string {
  return value.replace(/\D/g, "").slice(0, length);
}

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  containerClassName?: string;
}

export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  length = OTP_CODE_LENGTH,
  disabled = false,
  autoFocus = false,
  invalid = false,
  ariaLabelledBy,
  ariaDescribedBy,
  containerClassName,
}: OtpCodeInputProps) {
  const t = useTranslations("Components.OtpCodeInput");

  return (
    <InputOTP
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      pasteTransformer={(next) => normalizeOtpDigits(next, length)}
      value={value}
      onChange={(next) => onChange(normalizeOtpDigits(next, length))}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-invalid={invalid}
      containerClassName={cn("justify-center", containerClassName)}
    >
      <InputOTPGroup>
        {Array.from({ length }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            aria-label={t("digitAriaLabel", {
              index: index + 1,
              total: length,
            })}
            className="h-11 w-10 text-lg font-mono tabular-nums sm:h-12 sm:w-11"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
