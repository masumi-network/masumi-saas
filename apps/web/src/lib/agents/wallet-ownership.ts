import "server-only";

import prisma from "@masumi/database/client";

import type { PaymentNodeNetwork } from "@/lib/payment-node";
import { getPaymentNodeClientForUser } from "@/lib/payment-node/get-user-client";

const DEFAULT_NETWORK: PaymentNodeNetwork = "Preprod";
const PAYMENT_NODE_REGISTRY_MAX_PAGES = 25;

const LOCAL_WALLET_OWNED_FALLBACK_STATES = new Set([
  "RegistrationRequested",
  "RegistrationInitiated",
  "RegistrationFailed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationFailed",
]);

type AgentWithReference = {
  registrationState: string;
  agentIdentifier: string | null;
  networkIdentifier: string | null;
  agentReference: {
    externalId: string | null;
    networkIdentifier: string | null;
    sellingWalletVkey: string | null;
  } | null;
};

function getAgentNetwork(agent: {
  networkIdentifier: string | null;
  agentReference?: { networkIdentifier: string | null } | null;
}): PaymentNodeNetwork {
  const network =
    agent.agentReference?.networkIdentifier ?? agent.networkIdentifier;
  return network === "Mainnet" ? "Mainnet" : DEFAULT_NETWORK;
}

function isLocallyVisibleWalletOwnedAgent(agent: AgentWithReference): boolean {
  return Boolean(
    agent?.agentReference?.sellingWalletVkey &&
    LOCAL_WALLET_OWNED_FALLBACK_STATES.has(agent.registrationState),
  );
}

async function getVisibleRegistryKeysForUser(
  userId: string,
  network: PaymentNodeNetwork,
): Promise<{
  externalIds: Set<string>;
  agentIdentifiers: Set<string>;
} | null> {
  const client = await getPaymentNodeClientForUser(userId);
  if (!client) return null;

  const externalIds = new Set<string>();
  const agentIdentifiers = new Set<string>();
  let cursorId: string | undefined;

  for (let page = 0; page < PAYMENT_NODE_REGISTRY_MAX_PAGES; page += 1) {
    const { Assets } = await client.getRegistry({
      network,
      cursorId,
    });

    for (const asset of Assets) {
      externalIds.add(asset.id);
      if (asset.agentIdentifier) {
        agentIdentifiers.add(asset.agentIdentifier);
      }
    }

    if (Assets.length === 0) break;

    const nextCursor = Assets[Assets.length - 1]?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return { externalIds, agentIdentifiers };
}

function isVisibleViaPaymentNode(
  agent: AgentWithReference,
  visibleKeys: {
    externalIds: Set<string>;
    agentIdentifiers: Set<string>;
  } | null,
): boolean {
  if (!visibleKeys) return false;
  if (
    agent.agentReference?.externalId &&
    visibleKeys.externalIds.has(agent.agentReference.externalId)
  ) {
    return true;
  }
  if (
    agent.agentIdentifier &&
    visibleKeys.agentIdentifiers.has(agent.agentIdentifier)
  ) {
    return true;
  }
  return false;
}

export async function listWalletOwnedAgentsForUser(params: {
  userId: string;
  network: PaymentNodeNetwork;
}) {
  const agents = await prisma.agent.findMany({
    where: {
      userId: params.userId,
      networkIdentifier: params.network,
    },
    include: {
      agentReference: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (agents.length === 0) return [];

  const visibleKeys = await getVisibleRegistryKeysForUser(
    params.userId,
    params.network,
  );

  return agents.filter(
    (agent) =>
      isLocallyVisibleWalletOwnedAgent(agent) ||
      isVisibleViaPaymentNode(agent, visibleKeys),
  );
}

export async function getWalletOwnedAgentForUser(params: {
  userId: string;
  agentId: string;
}) {
  const agent = await prisma.agent.findFirst({
    where: {
      id: params.agentId,
      userId: params.userId,
    },
    include: {
      agentReference: true,
    },
  });

  if (!agent) return null;
  if (isLocallyVisibleWalletOwnedAgent(agent)) return agent;

  const client = await getPaymentNodeClientForUser(params.userId);
  if (!client) return null;

  const network = getAgentNetwork(agent);

  if (agent.agentReference?.externalId) {
    const entry = await client.getRegistryById({
      id: agent.agentReference.externalId,
      network,
    });
    if (entry) return agent;
  }

  if (agent.agentIdentifier) {
    const entry = await client.getRegistryByAgentIdentifier({
      agentIdentifier: agent.agentIdentifier,
      network,
    });
    if (entry) return agent;
  }

  return null;
}
