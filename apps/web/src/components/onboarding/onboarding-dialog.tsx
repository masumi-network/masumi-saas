"use client";

import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Bot,
  Building2,
  Coins,
  FlaskConical,
  KeyRound,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { GridPageBackground } from "@/components/grid-page-background";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { completeOnboardingAction } from "@/lib/actions/onboarding.action";
import { cn } from "@/lib/utils";

const STEP_COUNT = 4;

const textRevealClass = (visible: boolean) =>
  cn(
    "transition-all duration-500 ease-out",
    visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
  );

function WelcomeStepContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 480),
      setTimeout(() => setPhase(2), 780),
    ];
    return () => timers.forEach(clearTimeout);
  }, [title, description]);

  return (
    <>
      <Image
        src="/assets/logo.png"
        alt=""
        width={72}
        height={72}
        priority
        className="size-[72px] animate-masumi-logo-enter rounded-full"
      />
      <h2
        className={cn(
          "mt-8 text-2xl font-semibold tracking-tight",
          textRevealClass(phase >= 1),
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "text-muted-foreground mt-3 max-w-lg text-[15px] leading-relaxed",
          textRevealClass(phase >= 2),
        )}
      >
        {description}
      </p>
    </>
  );
}

function StepTextContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 120),
      setTimeout(() => setPhase(2), 420),
    ];
    return () => timers.forEach(clearTimeout);
  }, [title, description]);

  return (
    <div className="md:self-start md:text-left">
      <h2
        className={cn(
          "text-2xl font-semibold tracking-tight",
          textRevealClass(phase >= 1),
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "text-muted-foreground mx-auto mt-3 max-w-sm text-[15px] leading-relaxed md:mx-0",
          textRevealClass(phase >= 2),
        )}
      >
        {description}
      </p>
    </div>
  );
}

function StepNavigation({
  step,
  labels,
  isLoading,
  onBack,
  onNext,
  onSkip,
  onFinish,
}: {
  step: number;
  labels: {
    skip: string;
    back: string;
    next: string;
    finish: string;
  };
  isLoading: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const isFirst = step === 0;
  const isLast = step === STEP_COUNT - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: STEP_COUNT }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              index === step ? "bg-primary" : "bg-muted-foreground/25",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onSkip}
          disabled={isLoading}
        >
          {labels.skip}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isFirst || isLoading}
          >
            <ArrowLeft className="size-4" />
            {labels.back}
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={onFinish} disabled={isLoading}>
              {labels.finish}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={isLoading}>
              {labels.next}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FlowConnector({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "text-primary/45 -my-px flex h-4 w-full items-stretch justify-center overflow-hidden transition-all duration-500 ease-out",
        visible ? "opacity-100" : "max-h-0 opacity-0",
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 2 16"
        className="h-full w-[2px]"
        preserveAspectRatio="none"
        fill="none"
      >
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function FlowForkConnector({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "text-primary/50 w-full overflow-hidden transition-all duration-500 ease-out",
        visible ? "max-h-10 opacity-100" : "max-h-0 opacity-0",
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 300 32"
        className="mx-auto block h-8 w-full max-w-[300px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M150 0 V12 M72 12 H228 M72 12 V32 M228 12 V32"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="150" cy="12" r="2.5" className="fill-primary/70" />
        <circle cx="72" cy="12" r="2" className="fill-primary/70" />
        <circle cx="228" cy="12" r="2" className="fill-primary/70" />
      </svg>
    </div>
  );
}

function FlowBranchCard({
  icon,
  label,
  visible,
  children,
}: {
  icon: ReactNode;
  label: string;
  visible: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-background flex h-full min-h-[104px] flex-col items-center rounded-xl border px-2.5 py-3 text-center shadow-sm transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <div className="bg-primary/10 text-primary mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <span className="text-balance text-[11px] leading-snug font-medium">
        {label}
      </span>
      {children}
    </div>
  );
}

function FlowNode({
  icon,
  label,
  visible,
  highlighted = false,
  fullWidth = false,
}: {
  icon: ReactNode;
  label: string;
  visible: boolean;
  highlighted?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-background flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 shadow-sm transition-all duration-500",
        fullWidth ? "max-w-none" : "max-w-[240px]",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        highlighted && "border-primary/35 bg-primary/5",
      )}
    >
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </div>
      <span className="text-left text-xs leading-snug font-medium">
        {label}
      </span>
    </div>
  );
}

function AgentsVisual({
  apiLabel,
  registryLabel,
  escrowLabel,
}: {
  apiLabel: string;
  registryLabel: string;
  escrowLabel: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 650),
      setTimeout(() => setPhase(3), 1100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [apiLabel, escrowLabel, registryLabel]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5 py-6">
      <FlowNode
        icon={<Bot className="size-4" />}
        label={apiLabel}
        visible={phase >= 1}
      />
      <FlowConnector visible={phase >= 2} />
      <FlowNode
        icon={<Blocks className="size-4" />}
        label={registryLabel}
        visible={phase >= 2}
      />
      <FlowConnector visible={phase >= 3} />
      <FlowNode
        icon={<Lock className="size-4" />}
        label={escrowLabel}
        visible={phase >= 3}
        highlighted
      />
    </div>
  );
}

function OrganizationsVisual({
  workspaceLabel,
  membersLabel,
  kycLabel,
}: {
  workspaceLabel: string;
  membersLabel: string;
  kycLabel: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 650),
    ];
    return () => timers.forEach(clearTimeout);
  }, [kycLabel, membersLabel, workspaceLabel]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5 py-6">
      <div className="w-full max-w-[300px]">
        <div className="mx-auto w-full max-w-[210px]">
          <FlowNode
            icon={<Building2 className="size-4" />}
            label={workspaceLabel}
            visible={phase >= 1}
            fullWidth
          />
        </div>
        <FlowForkConnector visible={phase >= 2} />
        <div className="-mt-px grid grid-cols-2 gap-3">
          <FlowBranchCard
            icon={<Users className="size-4" />}
            label={membersLabel}
            visible={phase >= 2}
          >
            <div className="mt-auto flex justify-center pt-2.5 -space-x-1.5">
              {["A", "B", "C"].map((initial) => (
                <div
                  key={initial}
                  className="bg-muted text-muted-foreground ring-background flex size-6 items-center justify-center rounded-full text-[9px] font-semibold ring-2"
                >
                  {initial}
                </div>
              ))}
            </div>
          </FlowBranchCard>
          <FlowBranchCard
            icon={<ShieldCheck className="size-4" />}
            label={kycLabel}
            visible={phase >= 2}
          />
        </div>
      </div>
    </div>
  );
}

function PaymentsVisual({
  preprodLabel,
  creditsLabel,
  apiLabel,
}: {
  preprodLabel: string;
  creditsLabel: string;
  apiLabel: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 650),
      setTimeout(() => setPhase(3), 1100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [apiLabel, creditsLabel, preprodLabel]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5 py-6">
      <div className="flex w-full max-w-[240px] flex-col">
        <FlowNode
          icon={<FlaskConical className="size-4" />}
          label={preprodLabel}
          visible={phase >= 1}
          fullWidth
        />
        <FlowConnector visible={phase >= 2} />
        <FlowNode
          icon={<Coins className="size-4" />}
          label={creditsLabel}
          visible={phase >= 2}
          highlighted
          fullWidth
        />
        <FlowConnector visible={phase >= 3} />
        <FlowNode
          icon={<KeyRound className="size-4" />}
          label={apiLabel}
          visible={phase >= 3}
          fullWidth
        />
      </div>
    </div>
  );
}

interface OnboardingDialogProps {
  initialOpen: boolean;
}

export function OnboardingDialog({ initialOpen }: OnboardingDialogProps) {
  const t = useTranslations("App.Onboarding");
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    {
      title: t("steps.welcome.title"),
      description: t("steps.welcome.description"),
    },
    {
      title: t("steps.agents.title"),
      description: t("steps.agents.description"),
    },
    {
      title: t("steps.organizations.title"),
      description: t("steps.organizations.description"),
    },
    {
      title: t("steps.payments.title"),
      description: t("steps.payments.description"),
    },
  ];

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const result = await completeOnboardingAction();
      if (result.success) {
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(t(`errors.${result.errorKey}`));
    } catch {
      toast.error(t("errors.UnexpectedError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  const isWelcome = step === 0;
  const hasSplitLayout = !isWelcome;

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-6xl! h-full overflow-hidden border-none bg-transparent p-0 focus:ring-0 focus:outline-none md:h-auto sm:max-w-[calc(100%-2rem)] md:w-[90vw] [&>button]:hidden"
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogTitle className="hidden">{t("metadata.title")}</DialogTitle>
        <DialogDescription className="hidden">
          {t("metadata.description")}
        </DialogDescription>

        <div className="bg-background relative flex max-h-svh flex-col overflow-hidden rounded-xl shadow-lg md:max-h-[85vh] md:min-h-[560px]">
          <GridPageBackground
            className="rounded-xl"
            vignette
            opacity={0.22}
            animationDurationSeconds={28}
          />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              {hasSplitLayout && (
                <div
                  key={`visual-${step}`}
                  className="bg-muted flex h-64 shrink-0 border-b md:h-auto md:min-h-[320px] md:w-[42%] md:shrink md:border-r md:border-b-0"
                >
                  {step === 1 && (
                    <AgentsVisual
                      apiLabel={t("visuals.agents.api")}
                      registryLabel={t("visuals.agents.registry")}
                      escrowLabel={t("visuals.agents.escrow")}
                    />
                  )}
                  {step === 2 && (
                    <OrganizationsVisual
                      workspaceLabel={t("visuals.organizations.workspace")}
                      membersLabel={t("visuals.organizations.members")}
                      kycLabel={t("visuals.organizations.kyc")}
                    />
                  )}
                  {step === 3 && (
                    <PaymentsVisual
                      preprodLabel={t("visuals.payments.preprod")}
                      creditsLabel={t("visuals.payments.credits")}
                      apiLabel={t("visuals.payments.api")}
                    />
                  )}
                </div>
              )}

              <div
                key={`text-${step}`}
                className="flex flex-1 flex-col items-center justify-center p-6 text-center md:overflow-y-auto md:p-10"
              >
                {isWelcome ? (
                  <WelcomeStepContent
                    title={steps[0].title}
                    description={steps[0].description}
                  />
                ) : (
                  <StepTextContent
                    title={steps[step].title}
                    description={steps[step].description}
                  />
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-border/60 bg-background/80 px-6 pt-4 pb-6 backdrop-blur-sm md:px-10 md:pt-5 md:pb-8">
              <StepNavigation
                step={step}
                isLoading={isLoading}
                labels={{
                  skip: t("navigation.skip"),
                  back: t("navigation.back"),
                  next: t("navigation.next"),
                  finish: t("navigation.getStarted"),
                }}
                onBack={() => setStep((current) => current - 1)}
                onNext={() => setStep((current) => current + 1)}
                onSkip={() => void handleComplete()}
                onFinish={() => void handleComplete()}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
