"use client";

import { ChevronDown, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  startCreditTopUp,
  type StartCreditTopUpState,
} from "@/lib/actions/credits-top-up.action";
import {
  CREDIT_TOP_UP_AMOUNT_MAX,
  CREDIT_TOP_UP_AMOUNT_MIN,
  isAllowedCreditTopUpAmount,
  TOP_UP_PRESET_CREDIT_AMOUNTS,
} from "@/lib/stripe/top-up-constants";
import { cn } from "@/lib/utils";

type PurchaseTierOption = {
  credits: number;
  totalFormatted: string;
};

/** Slider is 0…TRACK_STEPS; credits use log scaling so presets aren’t mashed against the rail. */
const SLIDER_TRACK_STEPS = 10_000;

const LN_CREDIT_MIN = Math.log(CREDIT_TOP_UP_AMOUNT_MIN);
const LN_CREDIT_MAX = Math.log(CREDIT_TOP_UP_AMOUNT_MAX);

function creditsToSliderSteps(amount: number): number {
  const clamped = Math.min(
    CREDIT_TOP_UP_AMOUNT_MAX,
    Math.max(CREDIT_TOP_UP_AMOUNT_MIN, Math.round(amount)),
  );
  const t =
    (Math.log(clamped) - LN_CREDIT_MIN) / (LN_CREDIT_MAX - LN_CREDIT_MIN);
  return Math.round(Math.min(1, Math.max(0, t)) * SLIDER_TRACK_STEPS);
}

function sliderStepsToCreditsRaw(steps: number): number {
  const t =
    Math.min(SLIDER_TRACK_STEPS, Math.max(0, steps)) / SLIDER_TRACK_STEPS;
  return Math.round(
    Math.exp(LN_CREDIT_MIN + t * (LN_CREDIT_MAX - LN_CREDIT_MIN)),
  );
}

function parseCreditsDigits(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}

function useCollapseCustomSectionOnFineHover(): boolean {
  /** When true (fine pointer hover), custom block can stay collapsed until hover. */
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const mq =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mq) return;
    const sync = () => setEligible(Boolean(mq.matches));
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return eligible;
}

type TopUpPurchaseFormProps = {
  purchaseTiers: PurchaseTierOption[];
  stripeCheckoutCurrencyUpper: string;
  unitAmountCents: number;
  unitLabel: string;
};

export function TopUpPurchaseForm({
  purchaseTiers,
  stripeCheckoutCurrencyUpper,
  unitAmountCents,
  unitLabel,
}: TopUpPurchaseFormProps) {
  const t = useTranslations("App.TopUp");
  const [state, formAction, isPending] = useActionState<
    StartCreditTopUpState | undefined,
    FormData
  >(startCreditTopUp, undefined);

  const collapseHoverMode = useCollapseCustomSectionOnFineHover();
  /** Hover / click accordion; superseded visually by `panelExpanded`. */
  const [customSectionOpen, setCustomSectionOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  /** After collapsing via chevron while still hovered, suppress hover-expand until mouse leaves once. */
  const suppressHoverOpenRef = useRef(false);

  const clearHoverCloseTimer = () => {
    const id = closeTimerRef.current;
    if (id != null) {
      window.clearTimeout(id);
      closeTimerRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    clearHoverCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setCustomSectionOpen(false);
      closeTimerRef.current = null;
    }, 200);
  };

  const [credits, setCredits] = useState(25);
  const clampCredits = useCallback((n: number) => {
    const r = Math.round(n);
    return Math.min(
      CREDIT_TOP_UP_AMOUNT_MAX,
      Math.max(CREDIT_TOP_UP_AMOUNT_MIN, r),
    );
  }, []);

  const sliderStepsFromCredits = creditsToSliderSteps(credits);

  const setCreditsFromSlider = (stepsFromSlider: number) => {
    const raw = sliderStepsToCreditsRaw(stepsFromSlider);
    setCredits(clampCredits(raw));
    setManualDraft(null);
  };

  const [manualDraft, setManualDraft] = useState<string | null>(null);

  const creditsAllowed =
    credits !== null && isAllowedCreditTopUpAmount(credits);
  const canSubmit = creditsAllowed && !isPending;

  const hiddenCreditsValue =
    credits !== null && isAllowedCreditTopUpAmount(credits)
      ? String(credits)
      : "";

  const formatCheckoutMoney = useCallback(
    (minorUnitsCents: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: stripeCheckoutCurrencyUpper,
      }).format(minorUnitsCents / 100),
    [stripeCheckoutCurrencyUpper],
  );

  const estimatedTotalFormatted =
    creditsAllowed && unitAmountCents > 0
      ? formatCheckoutMoney(credits * unitAmountCents)
      : null;

  const manualDisplay = manualDraft ?? String(credits);

  const commitManualDraft = () => {
    if (manualDraft === null) return;
    const parsed = parseCreditsDigits(manualDraft.trim());
    setManualDraft(null);
    if (parsed !== null && isAllowedCreditTopUpAmount(parsed)) {
      setCredits(parsed);
    }
  };

  const manualPeek = manualDraft?.trim() ?? "";
  const parsedManualPeek =
    manualPeek !== "" ? parseCreditsDigits(manualPeek) : null;
  const showManualHint =
    manualDraft !== null &&
    manualPeek !== "" &&
    (parsedManualPeek === null ||
      (parsedManualPeek !== null &&
        !isAllowedCreditTopUpAmount(parsedManualPeek)));

  /** True when credits aren’t a committed preset (slider/exact ≠ quick button). */
  const hasCommittedCustomAmount =
    manualDraft === null &&
    !TOP_UP_PRESET_CREDIT_AMOUNTS.some((p) => p === credits);

  /** Any non‑preset quantity (shows Clear vs chevron affordance even while typing exact amount). */
  const isNonPresetCreditAmount = !TOP_UP_PRESET_CREDIT_AMOUNTS.some(
    (p) => p === credits,
  );

  /** Mobile / coarse: always expanded. Fine pointer: open on hover/click strip, typing, or non‑preset amount locked in. */
  const panelExpanded =
    !collapseHoverMode ||
    customSectionOpen ||
    manualDraft !== null ||
    hasCommittedCustomAmount;

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-6 rounded-xl border border-border/80 bg-muted/25 p-5 sm:p-6"
    >
      <input
        aria-hidden="true"
        name="credits"
        tabIndex={-1}
        type="hidden"
        value={hiddenCreditsValue}
      />

      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("purchaseTitle")}
        </h2>
        {unitLabel ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {unitLabel}
          </p>
        ) : null}
      </div>

      <fieldset className="min-w-0 space-y-6">
        <legend className="sr-only">{t("presetPackagesLegend")}</legend>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("quickAmountsTitle")}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {purchaseTiers.map(({ credits: amt, totalFormatted }) => {
              const selected = credits === amt && manualDraft === null;
              return (
                <button
                  key={amt}
                  type="button"
                  className={cn(
                    "flex flex-row items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3.5 text-left text-sm font-medium transition-colors",
                    "hover:bg-muted/50",
                    selected
                      ? "border-primary shadow-sm ring-2 ring-primary/25"
                      : "",
                  )}
                  aria-pressed={selected}
                  onClick={() => {
                    setCredits(amt);
                    setManualDraft(null);
                  }}
                >
                  <span className="tabular-nums tracking-tight">
                    {amt} {t("creditsWord")}
                  </span>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                    {totalFormatted}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section
          className="rounded-lg border border-border bg-background/70 outline-none md:rounded-lg md:bg-background/70 md:backdrop-blur-sm"
          onBlur={() => scheduleHoverClose()}
          onFocus={() => clearHoverCloseTimer()}
          onMouseEnter={() => {
            clearHoverCloseTimer();
            if (!suppressHoverOpenRef.current) {
              setCustomSectionOpen(true);
            }
          }}
          onMouseLeave={() => {
            suppressHoverOpenRef.current = false;
            scheduleHoverClose();
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5 md:py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">
                  {t("customCreditsLabel")}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                      aria-label={t("customCreditsTooltip", {
                        max: CREDIT_TOP_UP_AMOUNT_MAX.toLocaleString(),
                        min: CREDIT_TOP_UP_AMOUNT_MIN.toLocaleString(),
                      })}
                    >
                      <Info className="size-3.5 shrink-0" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-[min(18rem,calc(100vw-2rem))] text-balance"
                  >
                    {t("customCreditsTooltip", {
                      max: CREDIT_TOP_UP_AMOUNT_MAX.toLocaleString(),
                      min: CREDIT_TOP_UP_AMOUNT_MIN.toLocaleString(),
                    })}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="relative h-9 min-w-[4.25rem] shrink-0 sm:min-w-[4.75rem]">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-hidden={collapseHoverMode ? undefined : true}
                aria-expanded={collapseHoverMode ? panelExpanded : undefined}
                aria-controls={
                  collapseHoverMode ? "custom-credits-panel" : undefined
                }
                tabIndex={
                  collapseHoverMode && !isNonPresetCreditAmount ? 0 : -1
                }
                className={cn(
                  "absolute right-0 top-0 h-9 w-9 shrink-0 text-muted-foreground transition-[opacity,transform] duration-200 motion-reduce:transition-none hover:text-foreground",
                  isNonPresetCreditAmount &&
                    "pointer-events-none scale-95 opacity-0",
                  collapseHoverMode &&
                    !isNonPresetCreditAmount &&
                    "pointer-events-auto",
                  !collapseHoverMode &&
                    !isNonPresetCreditAmount &&
                    "pointer-events-none opacity-35",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!collapseHoverMode || isNonPresetCreditAmount) return;
                  clearHoverCloseTimer();
                  const pinnedOpen =
                    manualDraft !== null || hasCommittedCustomAmount;
                  if (pinnedOpen) return;
                  if (panelExpanded) {
                    suppressHoverOpenRef.current = true;
                    setCustomSectionOpen(false);
                  } else {
                    suppressHoverOpenRef.current = false;
                    setCustomSectionOpen(true);
                  }
                }}
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 transition-transform duration-200 motion-reduce:transition-none",
                    collapseHoverMode && panelExpanded && "rotate-180",
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "absolute right-0 top-0 h-9 min-w-[4.25rem] px-3 text-sm font-medium text-muted-foreground transition-opacity duration-200 ease-out hover:text-foreground sm:min-w-[4.75rem]",
                  isNonPresetCreditAmount
                    ? "pointer-events-auto opacity-100"
                    : "pointer-events-none opacity-0",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  clearHoverCloseTimer();
                  const next =
                    purchaseTiers.find((tier) => tier.credits === 25)
                      ?.credits ??
                    purchaseTiers[0]?.credits ??
                    TOP_UP_PRESET_CREDIT_AMOUNTS[0];
                  setCredits(next);
                  setManualDraft(null);
                  setCustomSectionOpen(false);
                }}
              >
                {t("resetCustomCredits")}
              </Button>
            </div>
          </div>

          <div
            id="custom-credits-panel"
            className={cn(
              "transition-[opacity,max-height] duration-300 ease-out",
              panelExpanded
                ? "max-h-none opacity-100"
                : "max-h-[min(5600px,92vh)] overflow-hidden px-4 opacity-0 md:max-h-0 md:px-0 md:opacity-0",
              collapseHoverMode &&
                manualDraft !== null &&
                "pointer-events-auto opacity-100",
            )}
          >
            {panelExpanded && (
              <div className={cn(!collapseHoverMode ? "pb-4" : "")}>
                <div className="space-y-5 border-t border-border/50 px-4 pb-4 pt-4 sm:px-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        id="credit-amount-heading"
                      >
                        {t("creditSliderLabel")}
                      </p>
                      <div className="flex flex-wrap items-baseline gap-3 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">
                          {credits.toLocaleString()} {t("creditsWord")}
                        </span>
                        {estimatedTotalFormatted ? (
                          <span className="tabular-nums text-muted-foreground">
                            {estimatedTotalFormatted}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Slider
                      aria-labelledby="credit-amount-heading"
                      className="w-full max-w-none pt-1"
                      max={SLIDER_TRACK_STEPS}
                      min={0}
                      step={1}
                      value={[sliderStepsFromCredits]}
                      onValueChange={(v) => {
                        const next = v[0] ?? sliderStepsFromCredits;
                        setCreditsFromSlider(next);
                      }}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {CREDIT_TOP_UP_AMOUNT_MIN}
                      </span>
                      <span className="tabular-nums">
                        {CREDIT_TOP_UP_AMOUNT_MAX.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 border-border/60 pt-2 sm:border-t">
                    <Label
                      className="text-foreground"
                      htmlFor="credit-custom-amount"
                    >
                      {t("exactCreditsLabel")}
                    </Label>
                    <Input
                      aria-invalid={showManualHint ? true : undefined}
                      autoComplete="off"
                      id="credit-custom-amount"
                      inputMode="numeric"
                      onBlur={() => {
                        commitManualDraft();
                      }}
                      onChange={(e) => {
                        const next = e.target.value;
                        setManualDraft(next);
                        setCustomSectionOpen(true);
                        suppressHoverOpenRef.current = false;
                        clearHoverCloseTimer();
                        const trimmed = next.trim();
                        if (trimmed === "") return;
                        const parsed = parseCreditsDigits(trimmed);
                        if (
                          parsed !== null &&
                          isAllowedCreditTopUpAmount(parsed)
                        ) {
                          setCredits(parsed);
                        }
                      }}
                      onFocus={() => {
                        setManualDraft(String(credits));
                        setCustomSectionOpen(true);
                        suppressHoverOpenRef.current = false;
                      }}
                      placeholder={t("customCreditsPlaceholder")}
                      type="text"
                      pattern="[0-9]*"
                      autoCorrect="off"
                      spellCheck={false}
                      value={manualDisplay}
                    />
                  </div>

                  {showManualHint ? (
                    <p className="text-sm text-destructive" role="alert">
                      {t("customCreditsInvalid")}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      </fieldset>

      {state && state.ok === false ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          disabled={!canSubmit}
          type="submit"
          className="w-full sm:w-auto"
        >
          {isPending ? t("processing") : t("ctaPay")}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground sm:max-w-sm sm:text-end">
          {t("purchaseFootnote")}
        </p>
      </div>
    </form>
  );
}
