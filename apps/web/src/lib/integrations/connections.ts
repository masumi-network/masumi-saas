import "server-only";

import prisma from "@masumi/database/client";

import {
  decryptPaymentNodeSecret,
  encryptPaymentNodeSecret,
} from "@/lib/payment-node";

export type IntegrationScope = {
  userId: string;
  organizationId: string | null;
};

export async function createIntegrationConnection(params: {
  scope: IntegrationScope;
  provider: "LANGDOCK";
  name: string;
  secret: string;
  metadata?: Record<string, unknown>;
}) {
  const encryptedSecret = await encryptPaymentNodeSecret(params.secret);
  return prisma.integrationConnection.create({
    data: {
      provider: params.provider,
      name: params.name,
      encryptedSecret,
      userId: params.scope.userId,
      organizationId: params.scope.organizationId,
      metadata: params.metadata,
    },
  });
}

export async function getScopedIntegrationConnection(params: {
  scope: IntegrationScope;
  id: string;
}) {
  return prisma.integrationConnection.findFirst({
    where: {
      id: params.id,
      userId: params.scope.userId,
      organizationId: params.scope.organizationId,
    },
  });
}

export async function listScopedIntegrationConnections(params: {
  scope: IntegrationScope;
  provider?: "LANGDOCK";
}) {
  return prisma.integrationConnection.findMany({
    where: {
      userId: params.scope.userId,
      organizationId: params.scope.organizationId,
      ...(params.provider ? { provider: params.provider } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function decryptIntegrationConnectionSecret(connection: {
  encryptedSecret: string;
}) {
  return decryptPaymentNodeSecret(connection.encryptedSecret);
}

export function serializeIntegrationConnection(connection: {
  id: string;
  provider: string;
  name: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    provider: connection.provider,
    name: connection.name,
    metadata: connection.metadata,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}
