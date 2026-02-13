"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient, twoFactor, useSession } from "@/lib/auth/auth.client";

type SetupStep = "idle" | "password" | "qr" | "backup" | "verify" | "done";

export function TwoFactorSection() {
  const t = useTranslations("App.Account.TwoFactor");
  const { data: session, isPending } = useSession();
  const [step, setStep] = useState<SetupStep>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [showNewBackupCodes, setShowNewBackupCodes] = useState(false);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  const is2FAEnabled = session?.user?.twoFactorEnabled;

  if (isPending) {
    return (
      <div className="rounded-xl border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Setup flow - Step: Enter password to enable
  async function handleEnableStart() {
    if (!password.trim()) return;
    setIsLoading(true);
    try {
      const { data, error } = await twoFactor.enable({
        password,
      });
      if (error) {
        toast.error(error.message || t("errors.enableFailed"));
        return;
      }
      if (data) {
        setTotpURI(data.totpURI);
        setBackupCodes(data.backupCodes);
        setStep("qr");
      }
    } catch {
      toast.error(t("errors.enableFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  // Setup flow - Step: Verify TOTP code to confirm setup
  async function handleVerify() {
    if (!verifyCode.trim() || verifyCode.length !== 6) return;
    setIsLoading(true);
    try {
      const { data, error } = await twoFactor.verifyTotp({
        code: verifyCode,
      });
      if (error) {
        toast.error(error.message || t("errors.invalidCode"));
        return;
      }
      if (data) {
        setStep("done");
        toast.success(t("enableSuccess"));
      }
    } catch {
      toast.error(t("errors.verifyFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  // Disable 2FA
  async function handleDisable() {
    if (!disablePassword.trim()) return;
    setIsLoading(true);
    try {
      const { error } = await twoFactor.disable({
        password: disablePassword,
      });
      if (error) {
        toast.error(error.message || t("errors.disableFailed"));
        return;
      }
      toast.success(t("disableSuccess"));
      setShowDisableDialog(false);
      setDisablePassword("");
      await authClient.getSession();
      resetSetup();
    } catch {
      toast.error(t("errors.disableFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  // Regenerate backup codes
  async function handleRegenerateBackupCodes() {
    if (!regeneratePassword.trim()) return;
    setIsLoading(true);
    try {
      const { data, error } = await twoFactor.generateBackupCodes({
        password: regeneratePassword,
      });
      if (error) {
        toast.error(error.message || t("errors.regenerateFailed"));
        return;
      }
      if (data?.backupCodes) {
        setBackupCodes(data.backupCodes);
        setShowRegenerateDialog(false);
        setShowNewBackupCodes(true);
        setRegeneratePassword("");
        toast.success(t("regenerateSuccess"));
      }
    } catch {
      toast.error(t("errors.regenerateFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  function resetSetup() {
    setStep("idle");
    setPassword("");
    setTotpURI("");
    setBackupCodes([]);
    setVerifyCode("");
  }

  function copyBackupCodes() {
    try {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      toast.success(t("setup.copied"));
    } catch {
      toast.error(t("errors.copyFailed"));
    }
  }

  function downloadBackupCodes() {
    const blob = new Blob(
      [
        `${t("title")} - ${t("setup.backupCodes")}\n${"=".repeat(30)}\n\n${backupCodes.join("\n")}\n\n${t("downloadNote1")}\n${t("downloadNote2")}`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── 2FA Enabled State ───
  if (is2FAEnabled && step === "idle") {
    return (
      <>
        <div className="rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium">{t("title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("description")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t("enabled")}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(true)}
            >
              {t("regenerateBackupCodes")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDisableDialog(true)}
            >
              {t("disable")}
            </Button>
          </div>
        </div>

        {/* Disable 2FA Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("disableConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("disableConfirmDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label
                  htmlFor="disable-2fa-password"
                  className="text-sm font-medium"
                >
                  {t("password")}
                </label>
                <Input
                  id="disable-2fa-password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisablePassword("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={isLoading || !disablePassword.trim()}
              >
                {isLoading ? <Spinner size={16} className="mr-2" /> : null}
                {t("disable")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate Backup Codes Dialog */}
        <Dialog
          open={showRegenerateDialog}
          onOpenChange={setShowRegenerateDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("regenerateConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("regenerateConfirmDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label
                  htmlFor="regenerate-password"
                  className="text-sm font-medium"
                >
                  {t("password")}
                </label>
                <Input
                  id="regenerate-password"
                  type="password"
                  value={regeneratePassword}
                  onChange={(e) => setRegeneratePassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRegenerateDialog(false);
                  setRegeneratePassword("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleRegenerateBackupCodes}
                disabled={isLoading || !regeneratePassword.trim()}
              >
                {isLoading ? <Spinner size={16} className="mr-2" /> : null}
                {t("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Show New Backup Codes Dialog */}
        <Dialog open={showNewBackupCodes} onOpenChange={setShowNewBackupCodes}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("setup.backupCodes")}</DialogTitle>
              <DialogDescription>
                {t("setup.backupDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 py-4">
              {backupCodes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-muted px-3 py-2 text-center text-sm font-mono"
                >
                  {code}
                </code>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                {t("setup.copyAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
                {t("setup.download")}
              </Button>
              <Button onClick={() => setShowNewBackupCodes(false)}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ─── 2FA Disabled State / Setup Flow ───
  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium">{t("title")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        {step === "idle" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("disabled")}
          </span>
        )}
      </div>

      {/* Step: Idle — Show enable button */}
      {step === "idle" && (
        <Button variant="primary" onClick={() => setStep("password")}>
          {t("enable")}
        </Button>
      )}

      {/* Step: Password — Enter password to start setup */}
      {step === "password" && (
        <div className="space-y-4 max-w-sm">
          <p className="text-sm text-muted-foreground">
            {t("enableDescription")}
          </p>
          <div>
            <label
              htmlFor="enable-2fa-password"
              className="text-sm font-medium"
            >
              {t("password")}
            </label>
            <Input
              id="enable-2fa-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              className="mt-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnableStart();
              }}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleEnableStart}
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? <Spinner size={16} className="mr-2" /> : null}
              {t("setup.continue")}
            </Button>
            <Button variant="outline" onClick={resetSetup}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Step: QR Code — Scan with authenticator app */}
      {step === "qr" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">{t("setup.scanQR")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("setup.scanDescription")}
            </p>
          </div>

          <div className="flex justify-center py-4">
            <div className="rounded-xl bg-white p-4">
              <QRCode
                value={totpURI}
                size={180}
                fgColor="black"
                bgColor="white"
                qrStyle="squares"
                quietZone={10}
              />
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              {t("setup.manualKey")}
            </summary>
            <code className="mt-2 block rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              {(() => {
                try {
                  return new URL(totpURI).searchParams.get("secret") ?? "";
                } catch {
                  return "";
                }
              })()}
            </code>
          </details>

          <div className="flex gap-3">
            <Button onClick={() => setStep("backup")}>
              {t("setup.continue")}
            </Button>
            <Button variant="outline" onClick={resetSetup}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Backup Codes — Save backup codes */}
      {step === "backup" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("setup.backupCodes")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("setup.backupDescription")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code) => (
              <code
                key={code}
                className="rounded bg-muted px-3 py-2 text-center text-sm font-mono"
              >
                {code}
              </code>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={copyBackupCodes}>
              {t("setup.copyAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
              {t("setup.download")}
            </Button>
          </div>

          <Button
            onClick={() => {
              setStep("verify");
              setTimeout(() => verifyInputRef.current?.focus(), 100);
            }}
          >
            {t("setup.continue")}
          </Button>
        </div>
      )}

      {/* Step: Verify — Enter TOTP code to confirm setup */}
      {step === "verify" && (
        <div className="space-y-4 max-w-sm">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("setup.verifyCode")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("setup.verifyDescription")}
            </p>
          </div>

          <div>
            <label htmlFor="verify-totp-code" className="sr-only">
              {t("setup.verifyCode")}
            </label>
            <Input
              id="verify-totp-code"
              ref={verifyInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-widest font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleVerify();
              }}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleVerify}
              disabled={isLoading || verifyCode.length !== 6}
            >
              {isLoading ? <Spinner size={16} className="mr-2" /> : null}
              {t("setup.complete")}
            </Button>
            <Button variant="outline" onClick={resetSetup}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Done — Success message */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3">
            <p className="text-sm text-green-500 font-medium">
              {t("enableSuccess")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await authClient.getSession();
              resetSetup();
            }}
          >
            {t("confirm")}
          </Button>
        </div>
      )}
    </div>
  );
}
