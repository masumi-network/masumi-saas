"use client";

import {
  AlertCircle,
  CircleHelp,
  ExternalLink,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Steps } from "@/components/ui/steps";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VeridianWalletConnect } from "@/components/veridian";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { credentialApiClient } from "@/lib/api/credential.client";
import {
  getKycStatusBadgeKey,
  getKycStatusBadgeVariant,
} from "@/lib/kyc-status";
import {
  getVerificationCodeSnippet,
  VERIFICATION_SNIPPET_LANGUAGES,
  type VerificationSnippetLang,
} from "@/lib/verification-code-snippets";

import { EstablishConnectionDialog } from "./establish-connection-dialog";

const STEP_COUNT = 3;

interface RequestVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null;
  onSuccess: () => void;
}

export function RequestVerificationDialog({
  open,
  onOpenChange,
  agent,
  kycStatus,
  onSuccess,
}: RequestVerificationDialogProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const tStatus = useTranslations("App.Agents");
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [aid, setAid] = useState<string | null>(null);
  const [oobi, setOobi] = useState<string | null>(null);
  const [connectionExists, setConnectionExists] = useState<boolean | null>(
    null,
  );
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [establishConnectionDialogOpen, setEstablishConnectionDialogOpen] =
    useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [snippetLang, setSnippetLang] =
    useState<VerificationSnippetLang>("node");
  const [showSecret, setShowSecret] = useState(false);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isRegeneratingChallenge, setIsRegeneratingChallenge] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const veridianConnectKeyRef = useRef(0);
  const lastCheckedAidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      veridianConnectKeyRef.current += 1;
      setAid(null);
      setOobi(null);
      setConnectionExists(null);
      setEstablishConnectionDialogOpen(false);
      setChallenge(null);
      setSecret(null);
      setShowSecret(false);
      setIssueError(null);
      lastCheckedAidRef.current = null;
    }
  }, [open]);

  // Fetch or generate verification challenge when dialog opens
  useEffect(() => {
    if (!open || !agent.id || kycStatus !== "APPROVED") return;

    let cancelled = false;
    setIsLoadingChallenge(true);
    agentApiClient
      .getVerificationChallenge(agent.id)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setChallenge(result.data.challenge);
          setSecret(result.data.secret);
        } else {
          toast.error(result.error || "Failed to get verification challenge");
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Failed to get verification challenge");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChallenge(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, agent.id, kycStatus]);

  const checkConnection = useCallback(
    async (aidToCheck: string, force = false) => {
      if (!force && lastCheckedAidRef.current === aidToCheck) {
        return;
      }

      setIsCheckingConnection(true);
      if (force) {
        lastCheckedAidRef.current = null;
      } else {
        lastCheckedAidRef.current = aidToCheck;
      }
      try {
        const result = await credentialApiClient.checkConnection(aidToCheck);
        if (result.success) {
          setConnectionExists(result.data.exists);
          lastCheckedAidRef.current = aidToCheck;
        } else {
          console.error("Failed to check connection:", result.error);
          setConnectionExists(null);
          lastCheckedAidRef.current = null;
        }
      } catch (error) {
        console.error("Failed to check connection:", error);
        setConnectionExists(null);
        lastCheckedAidRef.current = null;
      } finally {
        setIsCheckingConnection(false);
      }
    },
    [],
  );

  const handleAddressChange = useCallback(
    (address: string | null) => {
      if (address) {
        setAid(address);
        if (lastCheckedAidRef.current !== address) {
          checkConnection(address);
        }
      } else {
        setConnectionExists(null);
        lastCheckedAidRef.current = null;
      }
    },
    [checkConnection],
  );

  const handleWalletConnect = (
    connectedAid: string,
    connectedOobi?: string,
  ) => {
    setAid(connectedAid);
    if (connectedOobi) {
      setOobi(connectedOobi);
    }
  };

  const signMessage = async (): Promise<{
    signature: string;
    message: string;
  } | null> => {
    if (!aid) {
      toast.error("Please connect your Veridian wallet first");
      return null;
    }

    if (
      !(window as { cardano?: Record<string, unknown> }).cardano?.["idw_p2p"]
    ) {
      toast.error("Veridian wallet not connected");
      return null;
    }

    setIsSigning(true);
    try {
      const cardano = (window as { cardano?: Record<string, unknown> }).cardano;
      if (!cardano) {
        toast.error("Veridian wallet not connected");
        return null;
      }
      const api = cardano["idw_p2p"] as {
        enable: () => Promise<{
          experimental?: {
            signKeri?: (
              identifier: string,
              payload: string,
            ) => Promise<string | { error: unknown }>;
          };
        }>;
      };

      const enabledApi = await api.enable();

      if (!enabledApi.experimental?.signKeri) {
        toast.error("Signing not available in this wallet");
        return null;
      }

      const message = `Issue credential for agent verification\n\nAgent: ${agent.name}\nAgent ID: ${agent.id}\nAID: ${aid}\nTimestamp: ${new Date().toISOString()}\n\nBy signing this message, you confirm that you want to issue a verification credential for this agent.`;

      const signature = await enabledApi.experimental.signKeri(aid, message);

      if (typeof signature === "object" && "error" in signature) {
        const error = signature.error as { code?: number; info?: string };
        if (error.code === 2) {
          toast.error("Message signing declined");
        } else {
          toast.error(
            error.info || "Failed to sign message. Please try again.",
          );
        }
        return null;
      }

      return { signature: signature as string, message };
    } catch (error) {
      const err = error as { code?: number; info?: string };
      if (err.code === 2) {
        toast.error("Message signing declined");
      } else {
        toast.error(err.info || "Failed to sign message. Please try again.");
      }
      console.error("Failed to sign message:", error);
      return null;
    } finally {
      setIsSigning(false);
    }
  };

  const handleRegenerateChallenge = async () => {
    setIsRegeneratingChallenge(true);
    setIssueError(null);
    const result = await agentApiClient.getVerificationChallenge(
      agent.id,
      true,
    );
    if (result.success) {
      setChallenge(result.data.challenge);
      setSecret(result.data.secret);
      toast.success(t("challengeRegenerated"));
    } else {
      toast.error(result.error || "Failed to generate new challenge");
    }
    setIsRegeneratingChallenge(false);
  };

  const handleTestEndpoint = async (): Promise<boolean> => {
    setIsTestingEndpoint(true);
    setIssueError(null);
    const result = await agentApiClient.testVerificationEndpoint(agent.id);
    setIsTestingEndpoint(false);
    if (result.success) {
      toast.success(t("testEndpointSuccess"));
      return true;
    }
    toast.error(result.error || "Endpoint test failed");
    return false;
  };

  const handleNext = async () => {
    if (step === 0) {
      const success = await handleTestEndpoint();
      if (success) setStep(1);
    } else if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (kycStatus !== "APPROVED") {
      toast.error("Please complete your KYC verification first");
      return;
    }

    if (!aid) {
      toast.error("Please connect your Veridian wallet first");
      return;
    }

    if (!challenge) {
      toast.error(
        "Verification challenge not ready. Please wait or try again.",
      );
      return;
    }

    setIsSubmitting(true);
    setIssueError(null);
    try {
      const signatureData = await signMessage();
      if (!signatureData) {
        setIsSubmitting(false);
        return;
      }

      const result = await credentialApiClient.issueCredential({
        aid,
        oobi: oobi || undefined,
        agentId: agent.id,
        signature: signatureData.signature,
        signedMessage: signatureData.message,
      });

      if (result.success) {
        toast.success(t("requestSuccess"));
        onSuccess();
        onOpenChange(false);
        setAid(null);
      } else {
        setIssueError(result.error || t("requestError"));
        toast.error(result.error || t("requestError"));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : t("requestError");
      setIssueError(errMsg);
      toast.error(errMsg);
      console.error("Failed to issue credential:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnOpenChange = (newOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(newOpen);
  };

  const steps = [
    {
      title: t("stepEndpoint"),
      description: t("stepEndpointDescription"),
    },
    {
      title: t("stepWallet"),
      description: t("stepWalletDescription"),
    },
    {
      title: t("stepSubmit"),
      description: t("stepSubmitDescription"),
    },
  ];

  const isLastStep = step === STEP_COUNT - 1;

  const isNextDisabled =
    isTestingEndpoint ||
    !challenge ||
    !secret ||
    kycStatus !== "APPROVED" ||
    (step === 1 && (!aid || connectionExists !== true || isCheckingConnection));

  const getNextDisabledReason = (): string => {
    if (isTestingEndpoint) return t("nextDisabledReasonTestingEndpoint");
    if (!challenge || !secret) return t("nextDisabledReasonLoadingSetup");
    if (kycStatus !== "APPROVED") return t("nextDisabledReasonKycRequired");
    if (step === 1) {
      if (!aid) return t("nextDisabledReasonConnectWallet");
      if (isCheckingConnection)
        return t("nextDisabledReasonCheckingConnection");
      if (connectionExists !== true)
        return t("nextDisabledReasonEstablishConnection");
    }
    return t("nextDisabledReasonLoadingSetup");
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0"
        closeButtonClassName="top-8 right-4 -translate-y-1/2"
      >
        <div className="shrink-0 border-b bg-masumi-gradient px-6 py-5 pr-12">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("requestVerification")}
              </DialogTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t("requestDescription")}</TooltipContent>
              </Tooltip>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Steps currentStep={step + 1} steps={steps} className="mb-4" />
          <p className="text-sm text-muted-foreground mb-6">
            {steps[step]?.description}
          </p>

          {step !== 1 && kycStatus !== "APPROVED" && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">{t("kycStatus")}</h3>
              {kycStatus === "PENDING" ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {tStatus("status.pending")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("kycStatusPendingDescription")}
                    </p>
                  </div>
                  <Badge
                    variant={getKycStatusBadgeVariant(kycStatus)}
                    className="shrink-0"
                  >
                    {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                  </Badge>
                </div>
              ) : kycStatus === "REJECTED" ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {tStatus("status.rejected")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("kycStatusRejectedDescription")}
                    </p>
                  </div>
                  <Badge
                    variant={getKycStatusBadgeVariant(kycStatus)}
                    className="shrink-0"
                  >
                    {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {tStatus("status.pending")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("kycStatusPendingDescription")}
                    </p>
                  </div>
                  <Badge
                    variant={getKycStatusBadgeVariant(kycStatus)}
                    className="shrink-0"
                  >
                    {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="space-y-6">
            {/* Step 0: Endpoint setup */}
            {step === 0 && (
              <>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {t("agentInformation")}
                  </h3>
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {t("agentName")}
                      </span>
                      <p className="text-sm font-medium">{agent.name}</p>
                    </div>
                    <Separator />
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {t("apiUrl")}
                      </span>
                      <p className="font-mono text-xs text-muted-foreground">
                        {agent.apiUrl}
                      </p>
                    </div>
                  </div>
                </div>

                {kycStatus === "APPROVED" && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">
                      {t("agentVerification")}
                    </h3>
                    {isLoadingChallenge ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
                        <Spinner size={20} />
                        <p className="text-sm text-muted-foreground">
                          {t("loadingChallenge")}
                        </p>
                      </div>
                    ) : challenge && secret ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {t("agentVerificationDescription")}
                          </p>
                          <p className="text-xs font-medium">
                            {t("verificationSecret")}
                          </p>
                          <div className="flex items-center gap-2 overflow-hidden rounded bg-background p-2 font-mono text-xs">
                            <code className="min-w-0 flex-1 break-all select-all overflow-hidden">
                              {showSecret ? secret : "•".repeat(64)}
                            </code>
                            <div className="flex shrink-0 items-center gap-1">
                              <CopyButton value={secret} className="h-7 w-7" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setShowSecret((v) => !v)}
                                aria-label={
                                  showSecret ? "Hide secret" : "Show secret"
                                }
                              >
                                {showSecret ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t("agentVerificationSecretHint")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {t("integrationCode")}
                            </p>
                            <Select
                              value={snippetLang}
                              onValueChange={(v) =>
                                setSnippetLang(v as VerificationSnippetLang)
                              }
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {VERIFICATION_SNIPPET_LANGUAGES.map(
                                  ({ value }) => (
                                    <SelectItem key={value} value={value}>
                                      {t(`integrationCodeLanguage.${value}`)}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="relative overflow-hidden rounded-lg border">
                            <CodeEditor
                              value={getVerificationCodeSnippet(
                                secret,
                                snippetLang,
                              )}
                              language={
                                VERIFICATION_SNIPPET_LANGUAGES.find(
                                  (l) => l.value === snippetLang,
                                )?.monacoLang ?? "javascript"
                              }
                              height={280}
                            />
                            <div className="absolute right-2 top-2 z-[1000] rounded bg-background/80 backdrop-blur-sm">
                              <CopyButton
                                value={getVerificationCodeSnippet(
                                  secret,
                                  snippetLang,
                                )}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerateChallenge}
                            disabled={isRegeneratingChallenge}
                          >
                            {isRegeneratingChallenge && (
                              <Spinner size={14} className="mr-2" />
                            )}
                            {t("generateNewSignature")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {issueError && (
                  <div className="rounded-lg border border-destructive/60 bg-destructive/5 p-4 space-y-2">
                    <p className="text-sm text-destructive">{issueError}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("agentErrorHint")}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIssueError(null)}
                      >
                        {t("retry")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateChallenge}
                        disabled={isRegeneratingChallenge}
                      >
                        {t("generateNewSignature")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 1: Wallet connection */}
            {step === 1 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">
                  {t("veridianWalletConnection")}
                </h3>
                <VeridianWalletConnect
                  key={veridianConnectKeyRef.current}
                  onConnect={handleWalletConnect}
                  onAddressChange={handleAddressChange}
                  onError={(error) => {
                    toast.error(`Connection error: ${error}`);
                  }}
                />
                {aid && (
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("identifierAid")}
                      </p>
                      <p className="text-xs font-mono truncate">{aid}</p>
                    </div>
                    {isCheckingConnection ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                        <Spinner size={16} />
                        <p className="text-xs text-muted-foreground">
                          {t("checkingConnection")}
                        </p>
                      </div>
                    ) : connectionExists === false ? (
                      <div className="space-y-2">
                        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            {t("connectionNotEstablished")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEstablishConnectionDialogOpen(true)}
                          className="w-full"
                        >
                          {t("establishConnection")}
                        </Button>
                      </div>
                    ) : connectionExists === true ? (
                      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {t("connectionEstablished")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Credential info + ready to submit */}
            {step === 2 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{t("whatWillBeIssued")}</h3>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">
                    {t("credentialDescription")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <EstablishConnectionDialog
          open={establishConnectionDialogOpen}
          onOpenChange={setEstablishConnectionDialogOpen}
          aid={aid}
          onConnectionEstablished={() => {
            if (aid) {
              checkConnection(aid, true);
            }
          }}
        />

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 justify-between">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://www.masumi.network/contact"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("help")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={isSubmitting}
              >
                {t("prev")}
              </Button>
            )}
            {!isLastStep ? (
              isNextDisabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button variant="primary" onClick={handleNext} disabled>
                        {isTestingEndpoint && (
                          <Spinner size={16} className="mr-2" />
                        )}
                        {t("next")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{getNextDisabledReason()}</TooltipContent>
                </Tooltip>
              ) : (
                <Button variant="primary" onClick={handleNext}>
                  {t("next")}
                </Button>
              )
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  isSigning ||
                  !aid ||
                  !challenge ||
                  !secret ||
                  kycStatus !== "APPROVED"
                }
              >
                {(isSubmitting || isSigning) && (
                  <Spinner size={16} className="mr-2" />
                )}
                {isSigning ? "Signing..." : t("submitRequest")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
