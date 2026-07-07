import {
  credentialMatchesAgentRegistryId,
  parseStoredCredentialAttributes,
} from "@/lib/registry/stored-credential-attributes";

import { getIssuerSignifyClient } from "./issuer-keria-client";
import {
  PENDING_ISSUED_AT_SKEW_MS,
  type PendingCredentialRow,
} from "./resolve-pending-wallet-credential";

const IPEX_ADMIT_ROUTE = "/ipex/admit";

type ExchangeMessage = {
  exn: {
    d?: string;
    dt?: string;
    i?: string;
    p?: string;
    r?: string;
    rp?: string;
    e?: {
      acdc?: {
        d?: string;
        s?: string;
        a?: Record<string, unknown>;
      };
      exn?: ExchangeMessage["exn"];
    };
  };
};

function matchesPendingGrant(params: {
  grantMsg: ExchangeMessage;
  holderAid: string;
  schemaSaid: string;
  versionedAgentIdentifier: string | null;
  credentialSaid: string;
  expectedSignature: string | null;
}): boolean {
  const acdc = params.grantMsg.exn.e?.acdc;
  if (!acdc?.d || acdc.d !== params.credentialSaid) return false;
  if (acdc.s !== params.schemaSaid) return false;

  const issueeAid = acdc.a?.i;
  if (typeof issueeAid === "string" && issueeAid !== params.holderAid) {
    return false;
  }

  if (params.versionedAgentIdentifier) {
    const credAgentId = acdc.a?.agentId as string | undefined;
    if (
      !credentialMatchesAgentRegistryId(
        credAgentId,
        params.versionedAgentIdentifier,
      )
    ) {
      return false;
    }
  }

  if (params.expectedSignature) {
    const credSignature = acdc.a?.signature as string | undefined;
    if (credSignature !== params.expectedSignature) return false;
  }

  return true;
}

async function grantMatchesFromAdmit(
  client: Awaited<ReturnType<typeof getIssuerSignifyClient>>,
  admitMsg: ExchangeMessage,
  matchParams: {
    holderAid: string;
    schemaSaid: string;
    versionedAgentIdentifier: string | null;
    credentialSaid: string;
    expectedSignature: string | null;
    pendingSinceMs: number;
  },
): Promise<boolean> {
  if (!client) return false;

  const admitAt = new Date(admitMsg.exn.dt ?? 0).getTime();
  if (
    admitAt > 0 &&
    admitAt < matchParams.pendingSinceMs - PENDING_ISSUED_AT_SKEW_MS
  ) {
    return false;
  }

  if (admitMsg.exn.i && admitMsg.exn.i !== matchParams.holderAid) {
    return false;
  }

  const grantSaid = admitMsg.exn.p;
  if (!grantSaid) return false;

  let grantMsg: ExchangeMessage;
  try {
    grantMsg = (await client.exchanges().get(grantSaid)) as ExchangeMessage;
  } catch {
    return false;
  }

  return matchesPendingGrant({
    grantMsg,
    holderAid: matchParams.holderAid,
    schemaSaid: matchParams.schemaSaid,
    versionedAgentIdentifier: matchParams.versionedAgentIdentifier,
    credentialSaid: matchParams.credentialSaid,
    expectedSignature: matchParams.expectedSignature,
  });
}

async function findAdmitViaExchangeQuery(
  client: NonNullable<Awaited<ReturnType<typeof getIssuerSignifyClient>>>,
  holderAid: string,
): Promise<ExchangeMessage[]> {
  const list = (
    client.exchanges() as { list?: (args: object) => Promise<unknown> }
  ).list;
  if (typeof list !== "function") {
    return [];
  }

  const admits = (await list.call(client.exchanges(), {
    filter: {
      "-r": IPEX_ADMIT_ROUTE,
      "-i": holderAid,
    },
    limit: 50,
  })) as ExchangeMessage[];

  return Array.isArray(admits) ? admits : [];
}

async function findAdmitViaNotifications(
  client: NonNullable<Awaited<ReturnType<typeof getIssuerSignifyClient>>>,
): Promise<ExchangeMessage[]> {
  const notifications = await client.notifications().list();
  const notes = notifications.notes ?? [];
  const admits: ExchangeMessage[] = [];

  for (const notif of notes) {
    const said = notif.a?.d;
    if (!said) continue;

    try {
      const msg = (await client.exchanges().get(said)) as ExchangeMessage;
      if (msg.exn.r === IPEX_ADMIT_ROUTE) {
        admits.push(msg);
        continue;
      }

      const inner = msg.exn.e?.exn;
      if (inner?.r === IPEX_ADMIT_ROUTE) {
        admits.push({ exn: inner });
      }
    } catch {
      continue;
    }
  }

  return admits;
}

/**
 * True when the holder has submitted an IPEX admit on KERIA for the grant that
 * matches this pending issuance (wallet "Accept" in Veridian).
 */
export async function hasHolderAdmittedIpexGrant(params: {
  holderAid: string;
  pending: PendingCredentialRow;
  schemaSaid: string;
  versionedAgentIdentifier: string | null;
  credentialSaid: string;
}): Promise<boolean> {
  const client = await getIssuerSignifyClient();
  if (!client) {
    console.error(
      "[Veridian] Issuer KERIA client unavailable — cannot verify wallet admit",
    );
    return false;
  }

  const { attributes: expectedAttrs } = parseStoredCredentialAttributes(
    params.pending.attributes ?? params.pending.credentialData,
  );
  const expectedSignature =
    typeof expectedAttrs.signature === "string"
      ? expectedAttrs.signature
      : null;
  const pendingSinceMs = params.pending.createdAt.getTime();

  const matchParams = {
    holderAid: params.holderAid,
    schemaSaid: params.schemaSaid,
    versionedAgentIdentifier: params.versionedAgentIdentifier,
    credentialSaid: params.credentialSaid,
    expectedSignature,
    pendingSinceMs,
  };

  let admits: ExchangeMessage[] = [];
  try {
    admits = await findAdmitViaExchangeQuery(client, params.holderAid);
    if (admits.length === 0) {
      admits = await findAdmitViaNotifications(client);
    }
  } catch (error) {
    console.error("[Veridian] Failed to query IPEX admit exchanges:", error);
    return false;
  }

  const sortedAdmits = [...admits].sort((a, b) => {
    const dateA = new Date(a.exn.dt ?? 0).getTime();
    const dateB = new Date(b.exn.dt ?? 0).getTime();
    return dateB - dateA;
  });

  for (const admitMsg of sortedAdmits) {
    const matched = await grantMatchesFromAdmit(client, admitMsg, matchParams);
    if (matched) return true;
  }

  return false;
}
