"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DeviceCodeFormProps = {
  initialUserCode?: string;
};

const copy = {
  title: "Device Login",
  subtitle: "Enter the code shown in your CLI to approve the login request.",
  hint: "Dashes are optional. The code is not case sensitive.",
  continue: "Continue",
  checking: "Checking...",
};

function normalizeUserCode(value: string): string {
  return value.trim().replace(/-/g, "").toUpperCase();
}

export function DeviceCodeForm({ initialUserCode }: DeviceCodeFormProps) {
  const router = useRouter();
  const [userCode, setUserCode] = useState(initialUserCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedValue = useMemo(
    () => normalizeUserCode(userCode),
    [userCode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/auth/device?user_code=${encodeURIComponent(normalizedValue)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error_description?: string;
        } | null;
        setError(body?.error_description || "Invalid or expired device code.");
        return;
      }

      router.push(
        `/device/approve?user_code=${encodeURIComponent(normalizedValue)}`,
      );
    } catch {
      setError("Failed to verify device code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl font-light tracking-tight">
            {copy.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              disabled={isSubmitting}
              inputMode="text"
              maxLength={12}
              placeholder="ABCD1234"
              spellCheck={false}
              value={userCode}
              onChange={(event) => setUserCode(event.target.value)}
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{copy.hint}</p>
            )}
            <Button
              className="w-full"
              disabled={isSubmitting || normalizedValue.length === 0}
              type="submit"
              variant="primary"
            >
              {isSubmitting ? copy.checking : copy.continue}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
