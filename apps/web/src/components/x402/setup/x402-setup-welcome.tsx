"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Link2,
  TriangleAlert,
  Wallet as WalletIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Steps } from "@/components/ui/steps";
import { canManageX402OrgBudgets } from "@/lib/auth/org-roles";
import { useOrganizationContext } from "@/lib/context/organization-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { useX402Rail } from "@/lib/context/x402-rail-context";
import {
  useX402Budgets,
  useX402Networks,
  useX402Wallets,
} from "@/lib/hooks/use-x402";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { cn, shortenAddress } from "@/lib/utils";
import type { X402Network, X402Wallet } from "@/lib/x402/types";
import { chainsForEnv, isTestnetEnv } from "@/lib/x402-rail";

import { BudgetDialog } from "../budgets-tab";
import { ChainDialog } from "../chains-tab";
import { CreateWalletDialog } from "../wallets-tab";

type DialogKind = "wallet" | "chain" | "budget" | null;

export function X402SetupWelcome({
  networkType,
  embedded = false,
  onFinish,
}: {
  networkType?: PaymentNodeNetwork;
  embedded?: boolean;
  onFinish?: () => void;
}) {
  const t = useTranslations("App.X402.Setup");
  const tChains = useTranslations("App.X402.Chains");
  const queryClient = useQueryClient();
  const { network: contextNetwork } = usePaymentNetwork();
  const network = networkType ?? contextNetwork;
  const { setActiveRail, setSelectedX402ChainId, setIsSetupMode } =
    useX402Rail();
  const { activeOrganization, activeOrganizationId } = useOrganizationContext();
  const showBudgetFeatures = canManageX402OrgBudgets(
    activeOrganizationId,
    activeOrganization?.role,
  );
  const { wallets, isLoading: walletsLoading } = useX402Wallets();
  const { networks, isLoading: networksLoading } = useX402Networks({ network });
  const { budgets, isLoading: budgetsLoading } = useX402Budgets({
    enabled: showBudgetFeatures,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);
  const [walletType, setWalletType] = useState<X402Wallet["type"]>("Selling");

  const loading =
    walletsLoading || networksLoading || (showBudgetFeatures && budgetsLoading);
  const envChains = useMemo(
    () => chainsForEnv(networks, network),
    [networks, network],
  );
  const hasSellingWallet = wallets.some((wallet) => wallet.type === "Selling");
  const hasPurchasingWallet = wallets.some(
    (wallet) => wallet.type === "Purchasing",
  );
  const hasFacilitator = envChains.some((chain) => !!chain.facilitatorWalletId);
  const configuredChain =
    envChains.find((chain) => !!chain.facilitatorWalletId) ?? null;
  const wrongEnvChain = useMemo(() => {
    if (hasFacilitator) return null;
    const wantTestnet = isTestnetEnv(network);
    return (
      networks.find(
        (chain) =>
          chain.isEnabled &&
          !!chain.facilitatorWalletId &&
          chain.isTestnet !== wantTestnet,
      ) ?? null
    );
  }, [hasFacilitator, network, networks]);
  const envCaip2 = useMemo(() => {
    const wantTestnet = isTestnetEnv(network);
    return new Set(
      networks.filter((n) => n.isTestnet === wantTestnet).map((n) => n.caip2Id),
    );
  }, [networks, network]);
  const hasBudget = budgets.some((budget) => envCaip2.has(budget.caip2Network));

  const chainToConfigure: X402Network | null = useMemo(() => {
    const wantTestnet = isTestnetEnv(network);
    const envScoped = networks.filter((n) => n.isTestnet === wantTestnet);
    return (
      envScoped.find((n) => n.isEnabled && !n.facilitatorWalletId) ??
      envScoped[0] ??
      null
    );
  }, [networks, network]);

  const wizardSteps = useMemo(
    () =>
      showBudgetFeatures
        ? [
            {
              title: t("receivingTitle"),
              description: t("receivingDescription", { network }),
            },
            {
              title: t("payingTitle"),
              description: t("payingDescription"),
              optional: true,
            },
            {
              title: t("readyTitle"),
              description: t("readyDescription", { network }),
            },
          ]
        : [
            {
              title: t("receivingTitle"),
              description: t("receivingDescription", { network }),
            },
            {
              title: t("readyTitle"),
              description: t("readyDescription", { network }),
            },
          ],
    [network, showBudgetFeatures, t],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["x402", "wallets"] });
    queryClient.invalidateQueries({ queryKey: ["x402", "networks"] });
    queryClient.invalidateQueries({ queryKey: ["x402", "budgets"] });
  };

  const openWalletDialog = (type: X402Wallet["type"]) => {
    setWalletType(type);
    setOpenDialog("wallet");
  };

  const finish = () => {
    const configured =
      envChains.find((c) => !!c.facilitatorWalletId) ?? envChains[0] ?? null;
    if (configured) setSelectedX402ChainId(configured.id);
    setActiveRail("x402");
    setIsSetupMode(false);
    invalidate();
    onFinish?.();
  };

  const walletChips = (type: X402Wallet["type"]) => {
    const matching = wallets.filter((wallet) => wallet.type === type);
    if (matching.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {matching.map((wallet) => (
          <span
            key={wallet.id}
            className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs"
            title={wallet.address}
          >
            {wallet.note ? `${wallet.note} · ` : ""}
            {shortenAddress(wallet.address, 6)}
          </span>
        ))}
      </div>
    );
  };

  const featureItems = [
    { icon: WalletIcon, label: t("features.wallet") },
    { icon: Link2, label: t("features.facilitator") },
    { icon: Coins, label: t("features.budget") },
  ];

  const welcomeContent = (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t("welcomeDescription", { network })}
      </p>
      <ul className="space-y-3">
        {featureItems.map((feature) => (
          <li
            key={feature.label}
            className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <feature.icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{feature.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const receivingContent = (
    <div
      className={cn(
        "space-y-4 rounded-lg border bg-muted/40 p-4",
        hasFacilitator && "border-green-500/20 bg-green-500/[0.04]",
      )}
    >
      {walletChips("Selling")}
      {hasFacilitator && configuredChain ? (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("facilitatorSet", { chain: configuredChain.displayName })}
        </p>
      ) : wrongEnvChain ? (
        <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t("facilitatorWrongEnvironment", {
            chain: wrongEnvChain.displayName,
            chainEnv: wrongEnvChain.isTestnet
              ? tChains("testnet")
              : tChains("mainnet"),
            network,
          })}
        </p>
      ) : hasSellingWallet ? (
        <p className="text-sm text-muted-foreground">
          {t("assignFacilitatorHint")}
        </p>
      ) : null}
      <Button
        variant={hasFacilitator ? "outline" : "default"}
        className="gap-2"
        onClick={() =>
          hasSellingWallet
            ? setOpenDialog("chain")
            : openWalletDialog("Selling")
        }
      >
        {!hasSellingWallet
          ? t("createSellingWallet")
          : hasFacilitator
            ? t("manageChain")
            : t("assignFacilitator")}
      </Button>
    </div>
  );

  const payingContent = (
    <div
      className={cn(
        "space-y-4 rounded-lg border bg-muted/40 p-4",
        hasBudget && "border-green-500/20 bg-green-500/[0.04]",
      )}
    >
      {walletChips("Purchasing")}
      {hasBudget ? (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("budgetConfigured")}
        </p>
      ) : hasPurchasingWallet ? (
        <p className="text-sm text-muted-foreground">{t("setBudgetHint")}</p>
      ) : null}
      <Button
        variant={hasBudget ? "outline" : "default"}
        className="gap-2"
        onClick={() =>
          hasPurchasingWallet
            ? setOpenDialog("budget")
            : openWalletDialog("Purchasing")
        }
      >
        {!hasPurchasingWallet
          ? t("createPurchasingWallet")
          : hasBudget
            ? t("manageBudgets")
            : t("setBudget")}
      </Button>
    </div>
  );

  const successContent = (
    <ul className="space-y-3">
      {[
        { label: t("receivingEnabled"), done: hasFacilitator, optional: false },
        { label: t("payingEnabled"), done: hasBudget, optional: true },
      ].map((item) => (
        <li
          key={item.label}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
            item.done
              ? "border-green-500/20 bg-green-500/5"
              : "border-border bg-muted/30 text-muted-foreground",
          )}
        >
          <Check
            className={cn(
              "h-4 w-4 shrink-0",
              item.done
                ? "text-green-600 dark:text-green-500"
                : "text-muted-foreground/50",
            )}
          />
          <span className="font-medium">
            {item.label}
            {item.optional && !item.done ? ` (${t("skipped")})` : ""}
          </span>
        </li>
      ))}
    </ul>
  );

  const stepContents = showBudgetFeatures
    ? [welcomeContent, receivingContent, payingContent, successContent]
    : [welcomeContent, receivingContent, successContent];

  const successStepIndex = stepContents.length - 1;
  const payingStepIndex = showBudgetFeatures ? 2 : -1;

  const footer = (() => {
    if (currentStep === 0) {
      return (
        <Button
          id="x402-setup-get-started"
          key="x402-setup-get-started"
          onClick={() => setCurrentStep(1)}
          className="gap-2"
          variant="primary"
        >
          {t("getStarted")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      );
    }

    if (currentStep === successStepIndex) {
      return (
        <Button
          id="x402-setup-finish"
          key="x402-setup-finish"
          onClick={finish}
          className="gap-2"
          variant="primary"
        >
          {embedded ? t("finishSetup") : t("goToX402")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <Button
            id="x402-setup-back-receiving"
            key="x402-setup-back-receiving"
            variant="outline"
            onClick={() => setCurrentStep(0)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <Button
            id="x402-setup-continue-receiving"
            key="x402-setup-continue-receiving"
            className="gap-2"
            variant="primary"
            disabled={!hasFacilitator}
            onClick={() => setCurrentStep(2)}
          >
            {t("continue")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      );
    }

    if (currentStep === payingStepIndex) {
      return (
        <>
          <Button
            id="x402-setup-back-paying"
            key="x402-setup-back-paying"
            variant="outline"
            onClick={() => setCurrentStep(1)}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <Button
            id="x402-setup-continue-paying"
            key="x402-setup-continue-paying"
            className="gap-2"
            variant="primary"
            onClick={() => setCurrentStep(3)}
          >
            {hasBudget ? t("continue") : t("skipForNow")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      );
    }

    return null;
  })();

  const activeWizardStep =
    currentStep > 0 ? wizardSteps[currentStep - 1] : undefined;

  if (embedded) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {currentStep > 0 && (
            <div className="shrink-0 border-b px-6 py-5">
              <Steps currentStep={currentStep} steps={wizardSteps} />
            </div>
          )}

          <DialogBody stagger={false} className="min-h-0 flex-1 space-y-4">
            {activeWizardStep ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">
                    {activeWizardStep.title}
                  </h3>
                  <Badge variant="outline">{network}</Badge>
                  {"optional" in activeWizardStep &&
                  activeWizardStep.optional ? (
                    <Badge variant="secondary">{t("optional")}</Badge>
                  ) : null}
                </div>
                {activeWizardStep.description ? (
                  <p className="text-sm text-muted-foreground">
                    {activeWizardStep.description}
                  </p>
                ) : null}
              </div>
            ) : null}
            {loading && currentStep > 0 ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <div key={currentStep}>{stepContents[currentStep]}</div>
            )}
          </DialogBody>

          {footer ? (
            <DialogFooter
              key={`x402-setup-footer-${currentStep}`}
              className={cn(
                "shrink-0 border-t bg-background px-6 py-4",
                currentStep > 0 &&
                  currentStep < successStepIndex &&
                  "sm:justify-between",
              )}
            >
              {footer}
            </DialogFooter>
          ) : null}
        </div>

        <CreateWalletDialog
          key={
            openDialog === "wallet"
              ? `wallet-open-${walletType}`
              : "wallet-closed"
          }
          open={openDialog === "wallet"}
          defaultType={walletType}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            invalidate();
          }}
        />
        <ChainDialog
          key={
            openDialog === "chain"
              ? `chain-${chainToConfigure?.id ?? "new"}-${network}`
              : "chain-closed"
          }
          open={openDialog === "chain"}
          editing={chainToConfigure}
          environmentNetwork={network}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            invalidate();
          }}
        />
        <BudgetDialog
          key={openDialog === "budget" ? "budget-open" : "budget-closed"}
          open={openDialog === "budget"}
          editing={null}
          onClose={() => setOpenDialog(null)}
          onSaved={() => {
            setOpenDialog(null);
            invalidate();
          }}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {currentStep > 0 && (
        <Steps currentStep={currentStep} steps={wizardSteps} className="mb-6" />
      )}
      {loading && currentStep > 0 ? (
        <Spinner />
      ) : (
        <div key={currentStep}>{stepContents[currentStep]}</div>
      )}
    </div>
  );
}
