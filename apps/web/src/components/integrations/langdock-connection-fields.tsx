"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export const NEW_LANGDOCK_CONNECTION = "__new__";

export type LangdockIntegrationConnection = {
  id: string;
  name: string;
  provider: string;
  metadata?: Record<string, unknown> | null;
};

export function prefillLangdockFromConnection<
  TFieldValues extends FieldValues = FieldValues,
>(
  connection: LangdockIntegrationConnection,
  setValue: (name: FieldPath<TFieldValues>, value: string) => void,
) {
  const metadata = connection.metadata ?? {};
  const agentId = metadata.lastAgentId;
  const baseUrl = metadata.baseUrl;
  if (typeof agentId === "string" && agentId) {
    setValue("langdockAgentId" as FieldPath<TFieldValues>, agentId);
  }
  if (typeof baseUrl === "string" && baseUrl) {
    setValue("langdockBaseUrl" as FieldPath<TFieldValues>, baseUrl);
  }
}

type LangdockConnectionFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  connections: LangdockIntegrationConnection[];
  connectionsLoading: boolean;
  testingLangdock: boolean;
  onTest: () => void;
  onConnectionSelect: (connectionId: string) => void;
  t: (key: string) => string;
};

export function LangdockConnectionFields<TFieldValues extends FieldValues>({
  control,
  connections,
  connectionsLoading,
  testingLangdock,
  onTest,
  onConnectionSelect,
  t,
}: LangdockConnectionFieldsProps<TFieldValues>) {
  const selectedConnectionId = useWatch({
    control,
    name: "integrationConnectionId" as FieldPath<TFieldValues>,
    defaultValue:
      NEW_LANGDOCK_CONNECTION as TFieldValues[FieldPath<TFieldValues>],
  });

  const usingNewConnection = selectedConnectionId === NEW_LANGDOCK_CONNECTION;

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t("runtimeLangdockTitle")}</p>
          <p className="text-xs leading-snug text-muted-foreground">
            {t("runtimeLangdockDescription")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2 text-xs"
          asChild
        >
          <Link href="/integrations" target="_blank" rel="noopener noreferrer">
            {t("langdockManageConnections")}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {connectionsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={16} />
          {t("langdockConnectionsLoading")}
        </div>
      ) : connections.length > 0 ? (
        <FormField
          control={control}
          name={"integrationConnectionId" as FieldPath<TFieldValues>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("langdockConnection")}</FormLabel>
              <Select
                value={String(field.value ?? NEW_LANGDOCK_CONNECTION)}
                onValueChange={(value) => {
                  field.onChange(value);
                  onConnectionSelect(value);
                }}
              >
                <FormControl>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t("langdockConnection")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NEW_LANGDOCK_CONNECTION}>
                    {t("langdockNewConnection")}
                  </SelectItem>
                  {connections.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id}>
                      {connection.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("langdockNoConnectionsHint")}
        </p>
      )}

      {usingNewConnection ? (
        <FormField
          control={control}
          name={"langdockApiKey" as FieldPath<TFieldValues>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("langdockApiKey")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder={t("langdockApiKeyPlaceholder")}
                  {...field}
                  value={String(field.value ?? "")}
                  className="h-11 font-mono text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={"langdockAgentId" as FieldPath<TFieldValues>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("langdockAgentId")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("langdockAgentIdPlaceholder")}
                  {...field}
                  value={String(field.value ?? "")}
                  className="h-11 font-mono text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={"langdockBaseUrl" as FieldPath<TFieldValues>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("langdockBaseUrl")}</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder={t("langdockBaseUrlPlaceholder")}
                  {...field}
                  value={String(field.value ?? "")}
                  className="h-11 font-mono text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onTest}
        disabled={testingLangdock}
        className="gap-2"
      >
        {testingLangdock ? (
          <Spinner size={16} />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {t("langdockTestAutofill")}
      </Button>
    </div>
  );
}
