"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ui/code-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  generateMIP004InputHash,
  generateRandomHex,
} from "@/lib/developers/testing-utils";
import { dialogStaggerClass } from "@/lib/dialog-motion";
import { cn } from "@/lib/utils";

export const INPUT_DATA_PRESETS = [
  {
    labelKey: "presets.textPrompt" as const,
    value: JSON.stringify(
      { prompt: "Summarize the latest advances in quantum computing" },
      null,
      2,
    ),
  },
  {
    labelKey: "presets.emailAnalysis" as const,
    value: JSON.stringify(
      {
        email: "user@example.com",
        name: "Jane Doe",
        action: "analyze",
      },
      null,
      2,
    ),
  },
  {
    labelKey: "presets.documentProcessing" as const,
    value: JSON.stringify(
      {
        "document-url": "https://example.com/report.pdf",
        language: "en",
        "output-format": "summary",
      },
      null,
      2,
    ),
  },
  {
    labelKey: "presets.multiFieldForm" as const,
    value: JSON.stringify(
      {
        "project-name": "My Project",
        description: "A sample project for testing",
        age: 30,
        newsletter: true,
        interests: ["Technology", "Science"],
      },
      null,
      2,
    ),
  },
];

/** Call with `useTranslations("Developers.testing.form")` — pass `t` for stable messages. */
export function createPaymentFormSchema(t: (key: string) => string) {
  return z.object({
    agentIdentifier: z.string().min(57, t("errors.agentIdentifier")),
    inputHash: z
      .string()
      .length(64, t("errors.inputHashLength"))
      .regex(/^[0-9a-fA-F]+$/, t("errors.inputHashHex")),
    identifierFromPurchaser: z
      .string()
      .min(14, t("errors.identifierMin"))
      .max(26, t("errors.identifierMax"))
      .regex(/^[0-9a-fA-F]+$/, t("errors.identifierHex")),
    metadata: z.string().optional(),
  });
}

export type PaymentFormValues = z.infer<
  ReturnType<typeof createPaymentFormSchema>
>;

export type PaidTestingAgent = {
  id: string;
  name: string;
  agentIdentifier: string;
};

export function useInputDataHash(
  setValue: UseFormSetValue<PaymentFormValues>,
  watch: UseFormWatch<PaymentFormValues>,
) {
  const [inputData, setInputData] = useState("");
  const [inputDataError, setInputDataError] = useState<string | null>(null);
  const t = useTranslations("Developers.testing.form");

  const identifierFromPurchaser = watch("identifierFromPurchaser");

  const recalculateHash = useCallback(
    async (data: string, identifier: string, isStale: () => boolean) => {
      if (isStale()) return;
      if (!data.trim()) {
        setValue("inputHash", "");
        setInputDataError(null);
        return;
      }
      try {
        if (isStale()) return;
        const parsed = JSON.parse(data) as unknown;
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          if (isStale()) return;
          setInputDataError(t("errors.inputDataObject"));
          setValue("inputHash", "");
          return;
        }
        if (isStale()) return;
        setInputDataError(null);
        const hash = await generateMIP004InputHash(
          parsed as Record<string, unknown>,
          identifier,
        );
        if (isStale()) return;
        setValue("inputHash", hash);
      } catch {
        if (isStale()) return;
        setInputDataError(t("errors.invalidJson"));
        setValue("inputHash", "");
      }
    },
    [setValue, t],
  );

  useEffect(() => {
    let cancelled = false;
    const isStale = () => cancelled;
    queueMicrotask(() => {
      void recalculateHash(inputData, identifierFromPurchaser, isStale);
    });
    return () => {
      cancelled = true;
    };
  }, [inputData, identifierFromPurchaser, recalculateHash]);

  const resetInputData = useCallback((defaultPreset = true) => {
    setInputData(defaultPreset ? INPUT_DATA_PRESETS[0]!.value : "");
    setInputDataError(null);
  }, []);

  return { inputData, setInputData, inputDataError, resetInputData };
}

interface PaymentFormFieldsProps {
  register: UseFormRegister<PaymentFormValues>;
  setValue: UseFormSetValue<PaymentFormValues>;
  control: Control<PaymentFormValues>;
  errors: FieldErrors<PaymentFormValues>;
  paidAgents: PaidTestingAgent[];
  isLoadingAgents: boolean;
  inputData: string;
  setInputData: (value: string) => void;
  inputDataError: string | null;
}

export function PaymentFormFields({
  register,
  setValue,
  control,
  errors,
  paidAgents,
  isLoadingAgents,
  inputData,
  setInputData,
  inputDataError,
}: PaymentFormFieldsProps) {
  const t = useTranslations("Developers.testing.form");
  const [isSpinning, setIsSpinning] = useState(false);

  const handleGenerateIdentifier = () => {
    setIsSpinning(true);
    setValue("identifierFromPurchaser", generateRandomHex(16));
    setTimeout(() => setIsSpinning(false), 500);
  };

  return (
    <>
      <div className={cn("space-y-2", dialogStaggerClass(1))}>
        <Label>
          {t("agentLabel")}{" "}
          <span className="text-red-500">{t("required")}</span>
        </Label>
        <Controller
          control={control}
          name="agentIdentifier"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                disabled={isLoadingAgents || paidAgents.length === 0}
                className={`h-11 transition-colors duration-200 ${errors.agentIdentifier ? "border-red-500" : ""}`}
              >
                <SelectValue
                  placeholder={
                    isLoadingAgents
                      ? t("loadingAgents")
                      : paidAgents.length === 0
                        ? t("noPaidAgents")
                        : t("selectAgent")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {paidAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.agentIdentifier}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.agentIdentifier && (
          <p className="text-sm text-red-500 animate-fade-in">
            {errors.agentIdentifier.message}
          </p>
        )}
        {paidAgents.length === 0 && !isLoadingAgents && (
          <p className="text-xs text-muted-foreground">{t("freeAgentsHint")}</p>
        )}
      </div>

      <div className={cn("space-y-2", dialogStaggerClass(2))}>
        <div className="flex items-center justify-between">
          <Label>
            {t("purchaserIdLabel")}{" "}
            <span className="text-red-500">{t("required")}</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerateIdentifier}
            className="h-6 text-xs hover:bg-muted/80 transition-colors duration-150"
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 transition-transform duration-500 ${isSpinning ? "animate-spin" : ""}`}
            />
            {t("regenerate")}
          </Button>
        </div>
        <Input
          {...register("identifierFromPurchaser")}
          placeholder={t("purchaserIdPlaceholder")}
          className={`h-11 font-mono text-sm transition-colors duration-200 ${errors.identifierFromPurchaser ? "border-red-500" : ""}`}
        />
        {errors.identifierFromPurchaser && (
          <p className="text-sm text-red-500 animate-fade-in">
            {errors.identifierFromPurchaser.message}
          </p>
        )}
      </div>

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border/80 bg-muted/40 p-4",
          dialogStaggerClass(3),
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t.rich("mip004Blurb", {
              link: (chunks) => (
                <a
                  href="https://docs.masumi.network/mips/_mip-004"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5 hover:text-foreground transition-colors duration-150"
                >
                  {chunks}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ),
            })}
          </p>
          <Select onValueChange={(value) => setInputData(value)}>
            <SelectTrigger className="w-[160px] h-7 text-xs shrink-0">
              <SelectValue placeholder={t("loadPreset")} />
            </SelectTrigger>
            <SelectContent>
              {INPUT_DATA_PRESETS.map((preset) => (
                <SelectItem key={preset.labelKey} value={preset.value}>
                  {t(preset.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            {t("inputDataLabel")}{" "}
            <span className="text-red-500">{t("required")}</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("inputDataPlaceholder")}
          </p>
          <div
            className={cn(
              "overflow-hidden rounded-md border bg-background",
              inputDataError ? "border-red-500" : "border-border",
            )}
          >
            <CodeEditor
              value={inputData}
              onChange={setInputData}
              language="json"
              height={160}
              className="[&_.monaco-editor]:rounded-none"
            />
          </div>
          {inputDataError && (
            <p className="text-sm text-red-500 animate-fade-in">
              {inputDataError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground font-normal">
            {t("inputHashLabel")}
          </Label>
          <Input
            {...register("inputHash")}
            readOnly
            placeholder={t("inputHashPlaceholder")}
            className={`h-11 font-mono text-sm bg-background cursor-default transition-colors duration-200 ${errors.inputHash ? "border-red-500" : ""}`}
          />
          {errors.inputHash && (
            <p className="text-sm text-red-500 animate-fade-in">
              {errors.inputHash.message}
            </p>
          )}
        </div>
      </div>

      <div className={cn("space-y-2", dialogStaggerClass(4))}>
        <Label>{t("metadataLabel")}</Label>
        <Textarea
          {...register("metadata")}
          placeholder={t("metadataPlaceholder")}
          rows={2}
          className="resize-none min-h-[2.75rem]"
        />
      </div>
    </>
  );
}
