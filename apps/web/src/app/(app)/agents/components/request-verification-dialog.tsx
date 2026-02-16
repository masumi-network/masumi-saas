"use client";

import { AlertCircle, Eye, EyeOff, ShieldCheck, XCircle } from "lucide-react";
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
  DialogDescription,
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
      // Prevent duplicate checks for the same AID unless forced
      if (!force && lastCheckedAidRef.current === aidToCheck) {
        return;
      }

      setIsCheckingConnection(true);
      if (force) {
        lastCheckedAidRef.current = null; // Reset to allow re-check
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
        // Only check if it's a different AID
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

      // Create message to sign - this proves wallet ownership
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

      // Return signature and message for verification
      // The signature proves wallet ownership - cryptographic proof that the user
      // controls the private key for the AID
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

  const handleTestEndpoint = async () => {
    setIsTestingEndpoint(true);
    setIssueError(null);
    const result = await agentApiClient.testVerificationEndpoint(agent.id);
    if (result.success) {
      toast.success(t("testEndpointSuccess"));
    } else {
      toast.error(result.error || "Endpoint test failed");
    }
    setIsTestingEndpoint(false);
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
      // Request message signature to prove wallet ownership
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

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("requestVerification")}</DialogTitle>
          <DialogDescription>{t("requestDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("agentInformation")}</h3>
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
              <h3 className="text-sm font-medium">{t("agentVerification")}</h3>
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
                          {VERIFICATION_SNIPPET_LANGUAGES.map(({ value }) => (
                            <SelectItem key={value} value={value}>
                              {t(`integrationCodeLanguage.${value}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative overflow-hidden rounded-lg border">
                      <CodeEditor
                        value={getVerificationCodeSnippet(secret, snippetLang)}
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
                      onClick={handleTestEndpoint}
                      disabled={isTestingEndpoint}
                    >
                      {isTestingEndpoint && (
                        <Spinner size={14} className="mr-2" />
                      )}
                      {t("testEndpoint")}
                    </Button>
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

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("kycStatus")}</h3>
            {kycStatus === "APPROVED" ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tStatus("status.verified")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("kycStatusDescription")}
                  </p>
                </div>
                <Badge variant={getKycStatusBadgeVariant(kycStatus)}>
                  {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                </Badge>
              </div>
            ) : kycStatus === "PENDING" ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tStatus("status.pending")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("kycStatusPendingDescription")}
                  </p>
                </div>
                <Badge variant={getKycStatusBadgeVariant(kycStatus)}>
                  {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                </Badge>
              </div>
            ) : kycStatus === "REJECTED" ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4">
                <XCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tStatus("status.rejected")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("kycStatusRejectedDescription")}
                  </p>
                </div>
                <Badge variant={getKycStatusBadgeVariant(kycStatus)}>
                  {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {tStatus("status.pending")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("kycStatusPendingDescription")}
                  </p>
                </div>
                <Badge variant={getKycStatusBadgeVariant(kycStatus)}>
                  {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
                </Badge>
              </div>
            )}
          </div>

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

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("whatWillBeIssued")}</h3>
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                {t("credentialDescription")}
              </p>
            </div>
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOnOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
