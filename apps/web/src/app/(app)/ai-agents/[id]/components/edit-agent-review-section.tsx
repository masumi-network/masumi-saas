"use client";

import type { ReactNode } from "react";

import type { EditAgentFormValues } from "./edit-agent-form-values";

type EditAgentReviewLabels = {
  reviewSectionAgent: string;
  name: string;
  description: string;
  apiUrl: string;
  tags: string;
  termsOfUseUrl: string;
  privacyPolicyUrl: string;
  otherUrl: string;
  capabilityName: string;
  capabilityVersion: string;
  exampleOutputs: string;
};

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card">
      <div className="border-b bg-muted/20 px-4 py-3">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="divide-y divide-border/60 px-4">{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="py-3 first:pt-3 last:pb-3">
      <div className="flex items-start justify-between gap-4">
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
        <span className="min-w-0 break-words text-right text-sm">{value}</span>
      </div>
      {detail ? (
        <p className="mt-1 break-all text-right text-xs text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function formatExampleOutputs(outputs: EditAgentFormValues["exampleOutputs"]): {
  value: string;
  detail?: string;
} {
  const filled =
    outputs?.filter(
      (entry) => entry.name.trim() || entry.url.trim() || entry.mimeType.trim(),
    ) ?? [];
  if (filled.length === 0) {
    return { value: "—" };
  }
  const value = `${filled.length} output${filled.length === 1 ? "" : "s"}`;
  const detail = filled
    .map((entry) => {
      const name = entry.name.trim() || "—";
      const url = entry.url.trim() || "—";
      const mime = entry.mimeType.trim();
      return mime ? `${name}: ${url} (${mime})` : `${name}: ${url}`;
    })
    .join("; ");
  return { value, detail };
}

export function EditAgentReviewSection({
  values,
  tags,
  labels,
}: {
  values: EditAgentFormValues;
  tags: string[];
  labels: EditAgentReviewLabels;
}) {
  const description = values.description?.trim() || "—";
  const tagsLabel = tags.length > 0 ? tags.join(", ") : "—";
  const exampleSummary = formatExampleOutputs(values.exampleOutputs);

  const optionalUrl = (raw: string | undefined) => raw?.trim() || "—";

  return (
    <ReviewSection title={labels.reviewSectionAgent}>
      <SummaryRow label={labels.name} value={values.name.trim()} />
      <SummaryRow label={labels.description} value={description} />
      <SummaryRow label={labels.apiUrl} value={values.apiUrl.trim()} />
      <SummaryRow label={labels.tags} value={tagsLabel} />
      {optionalUrl(values.termsOfUseUrl) !== "—" ? (
        <SummaryRow
          label={labels.termsOfUseUrl}
          value={optionalUrl(values.termsOfUseUrl)}
        />
      ) : null}
      {optionalUrl(values.privacyPolicyUrl) !== "—" ? (
        <SummaryRow
          label={labels.privacyPolicyUrl}
          value={optionalUrl(values.privacyPolicyUrl)}
        />
      ) : null}
      {optionalUrl(values.otherUrl) !== "—" ? (
        <SummaryRow
          label={labels.otherUrl}
          value={optionalUrl(values.otherUrl)}
        />
      ) : null}
      {values.capabilityName?.trim() || values.capabilityVersion?.trim() ? (
        <SummaryRow
          label={labels.capabilityName}
          value={values.capabilityName?.trim() || "—"}
          detail={
            values.capabilityVersion?.trim()
              ? `${labels.capabilityVersion}: ${values.capabilityVersion.trim()}`
              : undefined
          }
        />
      ) : null}
      {exampleSummary.value !== "—" ? (
        <SummaryRow
          label={labels.exampleOutputs}
          value={exampleSummary.value}
          detail={exampleSummary.detail}
        />
      ) : null}
    </ReviewSection>
  );
}
