"use client";

import type { ReactNode } from "react";

import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { shortenAddress } from "@/lib/utils";
import { getPricingDisplayCompactParts } from "@/lib/utils/format-price";
import type { X402ProbeRowSnapshot } from "@/lib/x402/resource-autofill";

import type { X402OptionDraft } from "./x402-options-section";

type RegistrationKind = "STANDARD" | "X402_HTTP";
type RuntimeProvider = "DIRECT_MIP" | "LANGDOCK";
type PricingMode = "Free" | "Fixed" | "Dynamic";

export type RegisterAgentReviewValues = {
  registrationKind: RegistrationKind;
  x402ResourceUrl: string;
  name: string;
  description?: string;
  runtimeProvider: RuntimeProvider;
  apiUrl: string;
  langdockAgentId: string;
  pricingType: PricingMode;
  prices: Array<{ amount: string; asset: string }>;
  payoutAddress: string;
};

export type RegisterAgentReviewTranslations = {
  reviewSectionAgent: string;
  reviewSectionPayment: string;
  registrationKind: string;
  reviewRegistrationKindStandard: string;
  reviewRegistrationKindX402: string;
  reviewCardanoNetwork: string;
  reviewX402EvmNetwork: string;
  name: string;
  description: string;
  x402ResourceUrl: string;
  apiUrl: string;
  runtimeProvider: string;
  runtimeDirectTitle: string;
  runtimeLangdockTitle: string;
  langdockAgentId: string;
  tags: string;
  pricingModel: string;
  pricingFreeTitle: string;
  pricingDynamicTitle: string;
  payoutAddress: string;
  x402Title: string;
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

function formatPricingSummary(values: RegisterAgentReviewValues): string {
  if (values.pricingType === "Free") return "Free";
  if (values.pricingType === "Dynamic") return "Dynamic";
  const parts = getPricingDisplayCompactParts({
    pricingType: "Fixed",
    prices: values.prices
      .filter((p) => p.amount?.trim())
      .map((p) => ({
        amount: p.amount.trim(),
        currency: p.asset?.trim() || "USD",
      })),
  });
  return parts?.primary ?? "Fixed";
}

function formatX402OptionLine(option: X402OptionDraft): string {
  const network = option.caip2Network || "—";
  const amount = option.amount?.trim() || "—";
  const payTo = option.payTo?.trim();
  const payToLabel = payTo ? shortenAddress(payTo, 8) : "—";
  return `${amount} on ${network} · pay to ${payToLabel}`;
}

export function RegisterAgentReviewSection({
  values,
  tags,
  cardanoNetwork,
  evmCaip2Network,
  x402ProbeRow,
  x402Options,
  t,
}: {
  values: RegisterAgentReviewValues;
  tags: string[];
  cardanoNetwork: PaymentNodeNetwork;
  evmCaip2Network: string;
  x402ProbeRow: X402ProbeRowSnapshot | null;
  x402Options: X402OptionDraft[];
  t: RegisterAgentReviewTranslations;
}) {
  const isX402 = values.registrationKind === "X402_HTTP";
  const description = values.description?.trim() || "—";
  const tagsLabel = tags.length > 0 ? tags.join(", ") : "—";

  return (
    <div className="space-y-3">
      <ReviewSection title={t.reviewSectionAgent}>
        <SummaryRow
          label={t.registrationKind}
          value={
            isX402
              ? t.reviewRegistrationKindX402
              : t.reviewRegistrationKindStandard
          }
        />
        <SummaryRow label={t.name} value={values.name} />
        <SummaryRow label={t.description} value={description} />
        <SummaryRow label={t.tags} value={tagsLabel} />
        <SummaryRow label={t.reviewCardanoNetwork} value={cardanoNetwork} />
        {isX402 ? (
          <>
            <SummaryRow
              label={t.reviewX402EvmNetwork}
              value={evmCaip2Network}
            />
            <SummaryRow
              label={t.x402ResourceUrl}
              value={values.x402ResourceUrl.trim()}
              detail={
                x402ProbeRow?.scheme
                  ? `Scheme: ${x402ProbeRow.scheme}`
                  : undefined
              }
            />
          </>
        ) : (
          <>
            <SummaryRow
              label={t.runtimeProvider}
              value={
                values.runtimeProvider === "DIRECT_MIP"
                  ? t.runtimeDirectTitle
                  : t.runtimeLangdockTitle
              }
            />
            {values.runtimeProvider === "DIRECT_MIP" ? (
              <SummaryRow
                label={t.apiUrl}
                value={values.apiUrl.trim() || "—"}
              />
            ) : (
              <SummaryRow
                label={t.langdockAgentId}
                value={values.langdockAgentId.trim() || "—"}
              />
            )}
          </>
        )}
      </ReviewSection>

      {!isX402 ? (
        <ReviewSection title={t.reviewSectionPayment}>
          <SummaryRow
            label={t.pricingModel}
            value={
              values.pricingType === "Free"
                ? t.pricingFreeTitle
                : values.pricingType === "Dynamic"
                  ? t.pricingDynamicTitle
                  : formatPricingSummary(values)
            }
          />
          {values.pricingType !== "Free" && values.payoutAddress.trim() ? (
            <SummaryRow
              label={t.payoutAddress}
              value={shortenAddress(values.payoutAddress.trim(), 12)}
              detail={values.payoutAddress.trim()}
            />
          ) : null}
          {x402Options.length > 0 ? (
            <SummaryRow
              label={t.x402Title}
              value={`${x402Options.length} option${x402Options.length === 1 ? "" : "s"}`}
              detail={x402Options.map(formatX402OptionLine).join("; ")}
            />
          ) : null}
        </ReviewSection>
      ) : null}
    </div>
  );
}
