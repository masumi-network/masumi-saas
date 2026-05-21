"use client";

import { CheckCircle2, KeyRound, Plug, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Connection = {
  id: string;
  provider: string;
  name: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function IntegrationsPageContent() {
  const t = useTranslations("App.Integrations");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [name, setName] = useState("Langdock");

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/langdock", {
        credentials: "include",
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("loadError"));
      setConnections(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const saveConnection = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/integrations/langdock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          apiKey,
          agentId,
          baseUrl,
          name,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || t("saveError"));
      toast.success(t("saveSuccess"));
      setApiKey("");
      setAgentId("");
      setBaseUrl("");
      setName("Langdock");
      await loadConnections();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <section className="space-y-4 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Plug className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-medium">{t("langdockTitle")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("langdockDescription")}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("connectionName")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("apiKey")}</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("apiKeyPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("agentId")}</label>
            <Input
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder={t("agentIdPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("baseUrl")}</label>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.langdock.com"
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={saveConnection}
          disabled={saving || !apiKey.trim() || !agentId.trim()}
          className="w-full"
        >
          {saving && <Spinner size={16} className="mr-2" />}
          {t("testAndSave")}
        </Button>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">{t("connections")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("connectionsDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void loadConnections()}
            disabled={loading}
            aria-label={t("refresh")}
          >
            {loading ? (
              <Spinner size={16} />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {connections.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-md border border-dashed border-border px-4 text-center">
            <KeyRound className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="divide-y rounded-md border border-border">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {connection.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {String(connection.metadata?.lastAgentName ?? "Langdock")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("connected")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
