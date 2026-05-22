"use client";

import {
  AlertCircle,
  CircleHelp,
  ExternalLink,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { credentialApiClient } from "@/lib/api/credential.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";
import {
  getKycStatusBadgeKey,
  getKycStatusBadgeVariant,
} from "@/lib/kyc-status";
import { parseAidFromOobi } from "@/lib/veridian/parse-aid-from-oobi";
import {
  getVerificationCodeSnippet,
  VERIFICATION_SNIPPET_LANGUAGES,
  type VerificationSnippetLang,
} from "@/lib/verification-code-snippets";

const STEP_COUNT = 4;

const VERIDIAN_CONNECT_URL =
  process.env.NEXT_PUBLIC_VERIDIAN_KERIA_CONNECT_URL ?? "";
const VERIDIAN_BOOT_URL = process.env.NEXT_PUBLIC_VERIDIAN_KERIA_BOOT_URL ?? "";
const CREDENTIAL_POLL_MS = 3000;
const CREDENTIAL_POLL_MAX = 100;
const CONNECTION_POLL_MS = 4000;
const CONNECTION_POLL_MAX = 100;

type ConnectionMode = "oobi" | "direct";

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
  const agentVerificationEnabled = isAgentVerificationFlowEnabled();
  const tStatus = useTranslations("App.Agents");
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("oobi");
  const [walletOobiInput, setWalletOobiInput] = useState("");
  const [aidDirectInput, setAidDirectInput] = useState("");
  const [issuerOobi, setIssuerOobi] = useState<string | null>(null);
  const [isLoadingIssuerOobi, setIsLoadingIssuerOobi] = useState(false);

  const [connectionExists, setConnectionExists] = useState<boolean | null>(
    null,
  );
  /** True after {@link credentialApiClient.checkConnection} fails (network/API) — mirrors `connectionExists===false` for polling + retry UI. */
  const [connectionCheckFailed, setConnectionCheckFailed] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [snippetLang, setSnippetLang] =
    useState<VerificationSnippetLang>("node");
  const [showSecret, setShowSecret] = useState(false);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [isRegeneratingChallenge, setIsRegeneratingChallenge] = useState(false);
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [pendingCredentialId, setPendingCredentialId] = useState<string | null>(
    null,
  );
  const [isWaitingForAcceptance, setIsWaitingForAcceptance] = useState(false);
  const lastCheckedAidRef = useRef<string | null>(null);
  const prevDerivedAidRef = useRef<string | null>(null);
  const connPollAttemptsRef = useRef(0);
  /** Only reset poll counter when this key changes — not when connection state flaps during polling */
  const connPollSessionKeyRef = useRef<string>("");
  const onSuccessRef = useRef(onSuccess);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onOpenChangeRef.current = onOpenChange;
  }, [onSuccess, onOpenChange]);

  const derivedAid = useMemo(() => {
    if (connectionMode === "direct") {
      const trimmed = aidDirectInput.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    const raw = walletOobiInput.trim();
    if (!raw) return null;
    return parseAidFromOobi(raw);
  }, [connectionMode, aidDirectInput, walletOobiInput]);

  const invalidOobiPaste =
    connectionMode === "oobi" &&
    walletOobiInput.trim().length > 0 &&
    derivedAid === null;

  const walletOobiPayload = useMemo(() => {
    if (connectionMode !== "oobi") return undefined;
    const trim = walletOobiInput.trim();
    if (!trim || !derivedAid) return undefined;
    return trim;
  }, [connectionMode, walletOobiInput, derivedAid]);

  useEffect(() => {
    if (!agentVerificationEnabled) {
      return;
    }

    if (!open) {
      setStep(0);
      setConnectionMode("oobi");
      setWalletOobiInput("");
      setAidDirectInput("");
      setIssuerOobi(null);
      setConnectionExists(null);
      setConnectionCheckFailed(false);
      prevDerivedAidRef.current = null;
      lastCheckedAidRef.current = null;
      connPollAttemptsRef.current = 0;
      connPollSessionKeyRef.current = "";
      setChallenge(null);
      setSecret(null);
      setShowSecret(false);
      setIssueError(null);
      setPendingCredentialId(null);
      setIsWaitingForAcceptance(false);
    }
  }, [agentVerificationEnabled, open]);

  useEffect(() => {
    if (!agentVerificationEnabled) return;
    if (!open || step !== 2) return;

    let cancelled = false;
    setIsLoadingIssuerOobi(true);
    credentialApiClient
      .getIssuerOobi()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setIssuerOobi(result.data.oobi);
        } else {
          setIssuerOobi(null);
        }
      })
      .catch(() => {
        if (!cancelled) setIssuerOobi(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingIssuerOobi(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentVerificationEnabled, open, step]);

  // Fetch or generate verification challenge when dialog opens
  useEffect(() => {
    if (!agentVerificationEnabled) return;
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
          toast.error(result.error || t("toasts.challengeFailed"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("toasts.challengeFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChallenge(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentVerificationEnabled, open, agent.id, kycStatus, t]);

  // Poll for credential acceptance after issue (timeout so user is not trapped)
  const credentialPollAttemptsRef = useRef(0);
  const pollIntervalIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!agentVerificationEnabled) return;
    if (!pendingCredentialId || !isWaitingForAcceptance) return;
    credentialPollAttemptsRef.current = 0;

    const stopPolling = () => {
      if (pollIntervalIdRef.current !== null) {
        clearTimeout(pollIntervalIdRef.current);
        pollIntervalIdRef.current = null;
      }
    };

    const runPoll = async () => {
      credentialPollAttemptsRef.current += 1;
      if (credentialPollAttemptsRef.current > CREDENTIAL_POLL_MAX) {
        stopPolling();
        setIsWaitingForAcceptance(false);
        setPendingCredentialId(null);
        toast.error(t("acceptanceTimeout"));
        return;
      }

      const result =
        await credentialApiClient.checkCredentialStatus(pendingCredentialId);
      if (!result.success) {
        stopPolling();
        setIsWaitingForAcceptance(false);
        setPendingCredentialId(null);
        setIssueError(result.error);
        toast.error(result.error);
        return;
      }
      if (result.data.status === "ISSUED") {
        stopPolling();
        setIsWaitingForAcceptance(false);
        setPendingCredentialId(null);
        toast.success(t("requestSuccess"));
        onSuccessRef.current();
        onOpenChangeRef.current(false);
        return;
      }
      pollIntervalIdRef.current = setTimeout(runPoll, CREDENTIAL_POLL_MS);
    };

    runPoll();
    return () => {
      stopPolling();
    };
  }, [
    agentVerificationEnabled,
    pendingCredentialId,
    isWaitingForAcceptance,
    t,
  ]);

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
          setConnectionCheckFailed(false);
        } else {
          console.error("Failed to check connection:", result.error);
          setConnectionExists(null);
          setConnectionCheckFailed(true);
          lastCheckedAidRef.current = null;
        }
      } catch (error) {
        console.error("Failed to check connection:", error);
        setConnectionExists(null);
        setConnectionCheckFailed(true);
        lastCheckedAidRef.current = null;
      } finally {
        setIsCheckingConnection(false);
      }
    },
    [],
  );

  /** Latest `checkConnection` without listing it on polling deps (avoids reset when parent/chains change callback identity). */
  const checkConnectionRef = useRef(checkConnection);
  checkConnectionRef.current = checkConnection;

  // Direct AID entry must already be connected. OOBI entry is resolved by the
  // issue endpoint before issuance, so a first-time wallet can proceed.
  useEffect(() => {
    if (step !== 2) {
      return;
    }
    if (!derivedAid || invalidOobiPaste) {
      setConnectionExists(null);
      setConnectionCheckFailed(false);
      prevDerivedAidRef.current = null;
      lastCheckedAidRef.current = null;
      connPollAttemptsRef.current = 0;
      return;
    }

    if (prevDerivedAidRef.current !== derivedAid) {
      prevDerivedAidRef.current = derivedAid;
      setConnectionExists(null);
      setConnectionCheckFailed(false);
      lastCheckedAidRef.current = null;
      connPollAttemptsRef.current = 0;
    }
    if (connectionMode === "oobi") {
      setConnectionExists(null);
      setConnectionCheckFailed(false);
      lastCheckedAidRef.current = null;
      return;
    }
    void checkConnectionRef.current(derivedAid, true);
  }, [step, derivedAid, invalidOobiPaste, connectionMode]);

  // Poll credential server connection while not yet established (or initial check failed)
  useEffect(() => {
    const sessionKey = `${step}:${connectionMode}:${derivedAid ?? ""}:${invalidOobiPaste}`;
    if (connPollSessionKeyRef.current !== sessionKey) {
      connPollSessionKeyRef.current = sessionKey;
      connPollAttemptsRef.current = 0;
    }

    if (
      step !== 2 ||
      connectionMode !== "direct" ||
      !derivedAid ||
      invalidOobiPaste ||
      connectionExists === true ||
      !(connectionExists === false || connectionCheckFailed)
    ) {
      return;
    }

    const intervalHolder: { id: number | undefined } = { id: undefined };

    const tick = async () => {
      connPollAttemptsRef.current += 1;
      if (connPollAttemptsRef.current > CONNECTION_POLL_MAX) {
        if (intervalHolder.id !== undefined)
          window.clearInterval(intervalHolder.id);
        return;
      }
      await checkConnectionRef.current(derivedAid, true);
    };

    void tick();
    intervalHolder.id = window.setInterval(
      () => void tick(),
      CONNECTION_POLL_MS,
    );

    return () => {
      if (intervalHolder.id !== undefined)
        window.clearInterval(intervalHolder.id);
    };
  }, [
    step,
    connectionMode,
    derivedAid,
    invalidOobiPaste,
    connectionExists,
    connectionCheckFailed,
  ]);

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
      toast.error(result.error || t("toasts.regenerateChallengeFailed"));
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
    toast.error(result.error || t("toasts.endpointTestFailed"));
    return false;
  };

  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      const success = await handleTestEndpoint();
      if (success) setStep(2);
    } else if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (kycStatus !== "APPROVED") {
      toast.error(t("toasts.kycFirst"));
      return;
    }

    if (!derivedAid || invalidOobiPaste) {
      toast.error(t("toasts.needCredentialConnection"));
      return;
    }

    if (!challenge) {
      toast.error(t("toasts.challengeNotReady"));
      return;
    }

    setIsSubmitting(true);
    setIssueError(null);
    try {
      const result = await credentialApiClient.issueCredential({
        aid: derivedAid,
        oobi: walletOobiPayload,
        agentId: agent.id,
      });

      if (result.success) {
        if (result.data.status === "PENDING") {
          setPendingCredentialId(result.data.id);
          setIsWaitingForAcceptance(true);
        } else {
          toast.success(t("requestSuccess"));
          onSuccess();
          onOpenChange(false);
        }
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
    if (isSubmitting || isWaitingForAcceptance) return;
    onOpenChange(newOpen);
  };

  const steps = [
    {
      title: t("stepWalletSetup"),
      description: t("stepWalletSetupDescription"),
    },
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

  if (!agentVerificationEnabled) {
    return null;
  }

  const step2Blocked =
    !derivedAid ||
    invalidOobiPaste ||
    (connectionMode === "direct" &&
      (connectionExists !== true || isCheckingConnection));

  const isNextDisabled = (() => {
    if (step === 0) return false;
    if (kycStatus !== "APPROVED") return true;
    if (step === 1) return isTestingEndpoint || !challenge || !secret;
    if (step === 2) return step2Blocked;
    return false;
  })();

  const getNextDisabledReason = (): string => {
    if (step === 0) return "";
    if (kycStatus !== "APPROVED") return t("nextDisabledReasonKycRequired");
    if (step === 1) {
      if (isTestingEndpoint) return t("nextDisabledReasonTestingEndpoint");
      if (!challenge || !secret) return t("nextDisabledReasonLoadingSetup");
    }
    if (step === 2) {
      if (invalidOobiPaste) return t("invalidOobi");
      if (!derivedAid) return t("nextDisabledReasonPasteOobiOrAid");
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

        <DialogBody stagger={false} className="space-y-6">
          <Steps currentStep={step + 1} steps={steps} className="mb-4" />
          <p className="text-sm text-muted-foreground mb-6">
            {steps[step]?.description}
          </p>

          {step !== 0 && step !== 2 && kycStatus !== "APPROVED" && (
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
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {t("walletSetup.title")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("walletSetup.description")}
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {1}
                    </span>
                    <p className="text-sm font-medium">
                      {t("walletSetup.installStep")}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs whitespace-pre-line">
                        {t("walletSetup.osRequirements")}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground ml-7">
                    {t("walletSetup.installDescription")}
                  </p>
                  <div className="ml-7 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://apps.apple.com/ng/app/veridian-wallet/id6590628073"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Image
                          src="/assets/veridian/appstore.png"
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4"
                        />
                        {t("walletSetup.appStore")}
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://play.google.com/store/apps/details?id=org.cardanofoundation.idw"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Image
                          src="/assets/veridian/playstore.png"
                          alt=""
                          width={16}
                          height={16}
                          className="h-4 w-4"
                        />
                        {t("walletSetup.playStore")}
                      </a>
                    </Button>
                  </div>
                </div>

                {VERIDIAN_CONNECT_URL && VERIDIAN_BOOT_URL && (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {2}
                      </span>
                      <p className="text-sm font-medium">
                        {t("walletSetup.configureStep")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-7">
                      {t("walletSetup.configureDescription")}
                    </p>
                    <div className="ml-7 space-y-2">
                      <div>
                        <p className="text-xs font-medium mb-1">
                          {t("walletSetup.connectUrl")}
                        </p>
                        <div className="flex items-center gap-2 rounded bg-background p-2 font-mono text-xs">
                          <code className="min-w-0 flex-1 break-all select-all">
                            {VERIDIAN_CONNECT_URL}
                          </code>
                          <CopyButton
                            value={VERIDIAN_CONNECT_URL}
                            className="h-7 w-7 shrink-0"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">
                          {t("walletSetup.bootUrl")}
                        </p>
                        <div className="flex items-center gap-2 rounded bg-background p-2 font-mono text-xs">
                          <code className="min-w-0 flex-1 break-all select-all">
                            {VERIDIAN_BOOT_URL}
                          </code>
                          <CopyButton
                            value={VERIDIAN_BOOT_URL}
                            className="h-7 w-7 shrink-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
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
                                aria-label={t(
                                  showSecret
                                    ? "secretToggle.hide"
                                    : "secretToggle.show",
                                )}
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

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium">
                    {t("connectCredentialServer")}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("credentialServerInstructions")}
                  </p>
                </div>

                {connectionMode === "oobi" && (
                  <>
                    {isLoadingIssuerOobi ? (
                      <div className="flex items-center justify-center p-8">
                        <Spinner size={24} />
                      </div>
                    ) : issuerOobi ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-4">
                        <div className="p-4 rounded-lg flex items-center justify-center relative bg-background border">
                          <QRCode
                            value={issuerOobi}
                            size={200}
                            fgColor="black"
                            bgColor="white"
                            qrStyle="squares"
                            logoImage="/assets/qr-logo.png"
                            logoWidth={48}
                            logoHeight={48}
                            logoOpacity={1}
                            quietZone={10}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center max-w-md">
                          {t("scanIssuerQRCode")}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          {t("failedToLoadIssuerOobi")}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-1 text-muted-foreground hover:text-foreground self-start text-xs"
                  onClick={() => {
                    setConnectionMode((m) =>
                      m === "oobi" ? "direct" : "oobi",
                    );
                    setConnectionExists(null);
                    prevDerivedAidRef.current = null;
                    lastCheckedAidRef.current = null;
                  }}
                >
                  {connectionMode === "oobi"
                    ? t("alreadyConnected")
                    : t("useOobiPaste")}
                </Button>

                {connectionMode === "direct" ? (
                  <div className="space-y-2">
                    <Label htmlFor="aid-paste">{t("pasteAid")}</Label>
                    <Input
                      id="aid-paste"
                      value={aidDirectInput}
                      onChange={(e) => setAidDirectInput(e.target.value)}
                      placeholder={t("aidPlaceholder")}
                      className="font-mono text-xs"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="oobi-paste">{t("pasteOobi")}</Label>
                    <textarea
                      id="oobi-paste"
                      value={walletOobiInput}
                      onChange={(e) => setWalletOobiInput(e.target.value)}
                      placeholder={t("oobiPlaceholder")}
                      className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                )}

                {invalidOobiPaste && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-xs text-destructive">
                      {t("invalidOobi")}
                    </p>
                  </div>
                )}

                {derivedAid && !invalidOobiPaste ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("parsedAid")}
                      </p>
                      <p className="text-xs font-mono break-all">
                        {derivedAid}
                      </p>
                    </div>
                    {connectionMode === "direct" ? (
                      isCheckingConnection ? (
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                          <Spinner size={16} />
                          <p className="text-xs text-muted-foreground">
                            {t("checkingConnection")}
                          </p>
                        </div>
                      ) : connectionExists === false ||
                        connectionCheckFailed ? (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              {connectionCheckFailed
                                ? t("failedToCheckConnection")
                                : t("connectionNotEstablished")}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              derivedAid && checkConnection(derivedAid, true)
                            }
                            disabled={isCheckingConnection}
                            className="w-full"
                          >
                            {t("checkConnectionAgain")}
                          </Button>
                        </div>
                      ) : connectionExists === true ? (
                        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {t("connectionEstablished")}
                          </p>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}

            {step === 3 &&
              (isWaitingForAcceptance ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Spinner size={32} />
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">
                      {t("waitingForWalletAcceptance")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("waitingForWalletDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {t("whatWillBeIssued")}
                  </h3>
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                      {t("credentialDescription")}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </DialogBody>

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
                  {isTestingEndpoint && <Spinner size={16} className="mr-2" />}
                  {t("next")}
                </Button>
              )
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  isWaitingForAcceptance ||
                  !derivedAid ||
                  invalidOobiPaste ||
                  !challenge ||
                  !secret ||
                  kycStatus !== "APPROVED"
                }
              >
                {(isSubmitting || isWaitingForAcceptance) && (
                  <Spinner size={16} className="mr-2" />
                )}
                {isWaitingForAcceptance
                  ? t("waitingForIssuanceSubmit")
                  : t("submitRequest")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
