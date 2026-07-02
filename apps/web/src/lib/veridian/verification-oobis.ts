import { getCredentialServerUrl } from "@/lib/veridian";

export function buildCredentialServerOobiUrl(said: string): string {
  const base = getCredentialServerUrl().replace(/\/$/, "");
  return `${base}/oobi/${said}`;
}

export function buildVerificationOobis(params: {
  issuerOobi: string;
  schemaSaid: string;
  credentialSaid: string;
  holderOobi: string;
}): {
  issuerOobi: string;
  schemaOobi: string;
  credentialOobi: string;
  holderOobi: string;
} {
  return {
    issuerOobi: params.issuerOobi,
    schemaOobi: buildCredentialServerOobiUrl(params.schemaSaid),
    credentialOobi: buildCredentialServerOobiUrl(params.credentialSaid),
    holderOobi: params.holderOobi,
  };
}
