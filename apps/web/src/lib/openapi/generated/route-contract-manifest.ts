import type { RouteContractManifestEntry } from "../contracts";
import routeContract0 from "../../../app/api/activity/route.contract";
import routeContract1 from "../../../app/api/activity/transaction/route.contract";
import routeContract2 from "../../../app/api/agents/[agentId]/complete-registration/route.contract";
import routeContract3 from "../../../app/api/agents/[agentId]/deregister/route.contract";
import routeContract4 from "../../../app/api/agents/[agentId]/earnings/route.contract";
import routeContract5 from "../../../app/api/agents/[agentId]/route.contract";
import routeContract6 from "../../../app/api/agents/[agentId]/test-verification-endpoint/route.contract";
import routeContract7 from "../../../app/api/agents/[agentId]/transactions/route.contract";
import routeContract8 from "../../../app/api/agents/[agentId]/verification-challenge/route.contract";
import routeContract9 from "../../../app/api/agents/[agentId]/verify/route.contract";
import routeContract10 from "../../../app/api/agents/counts/route.contract";
import routeContract11 from "../../../app/api/agents/route.contract";
import routeContract12 from "../../../app/api/api-key-status/route.contract";
import routeContract13 from "../../../app/api/credentials/check-connection/route.contract";
import routeContract14 from "../../../app/api/credentials/issue/route.contract";
import routeContract15 from "../../../app/api/credentials/issuer-oobi/route.contract";
import routeContract16 from "../../../app/api/credentials/reconcile/route.contract";
import routeContract17 from "../../../app/api/credentials/schema-said/route.contract";
import routeContract18 from "../../../app/api/credentials/status/route.contract";
import routeContract19 from "../../../app/api/credits/route.contract";
import routeContract20 from "../../../app/api/dashboard/overview/route.contract";
import routeContract21 from "../../../app/api/earnings/agent/route.contract";
import routeContract22 from "../../../app/api/earnings/agents/route.contract";
import routeContract23 from "../../../app/api/earnings/route.contract";
import routeContract24 from "../../../app/api/health/route.contract";
import routeContract25 from "../../../app/api/masumi/inbox-agent/register/route.contract";
import routeContract26 from "../../../app/api/register/email/route.contract";
import routeContract27 from "../../../app/api/v1/agents/[agentId]/route.contract";
import routeContract28 from "../../../app/api/v1/agents/route.contract";
import routeContract29 from "../../../app/api/v1/agents/verify/route.contract";
import routeContract30 from "../../../app/credits/route.contract";
import routeContract31 from "../../../app/pay/api/v1/inbox-agents/[inboxAgentId]/deregister/route.contract";
import routeContract32 from "../../../app/pay/api/v1/inbox-agents/[inboxAgentId]/route.contract";
import routeContract33 from "../../../app/pay/api/v1/inbox-agents/route.contract";

export const routeContractManifest = [
  {
    contract: routeContract0,
    filePath: "src/app/api/activity/route.contract.ts",
    routePath: "/api/activity",
  },
  {
    contract: routeContract1,
    filePath: "src/app/api/activity/transaction/route.contract.ts",
    routePath: "/api/activity/transaction",
  },
  {
    contract: routeContract2,
    filePath:
      "src/app/api/agents/[agentId]/complete-registration/route.contract.ts",
    routePath: "/api/agents/{agentId}/complete-registration",
  },
  {
    contract: routeContract3,
    filePath: "src/app/api/agents/[agentId]/deregister/route.contract.ts",
    routePath: "/api/agents/{agentId}/deregister",
  },
  {
    contract: routeContract4,
    filePath: "src/app/api/agents/[agentId]/earnings/route.contract.ts",
    routePath: "/api/agents/{agentId}/earnings",
  },
  {
    contract: routeContract5,
    filePath: "src/app/api/agents/[agentId]/route.contract.ts",
    routePath: "/api/agents/{agentId}",
  },
  {
    contract: routeContract6,
    filePath:
      "src/app/api/agents/[agentId]/test-verification-endpoint/route.contract.ts",
    routePath: "/api/agents/{agentId}/test-verification-endpoint",
  },
  {
    contract: routeContract7,
    filePath: "src/app/api/agents/[agentId]/transactions/route.contract.ts",
    routePath: "/api/agents/{agentId}/transactions",
  },
  {
    contract: routeContract8,
    filePath:
      "src/app/api/agents/[agentId]/verification-challenge/route.contract.ts",
    routePath: "/api/agents/{agentId}/verification-challenge",
  },
  {
    contract: routeContract9,
    filePath: "src/app/api/agents/[agentId]/verify/route.contract.ts",
    routePath: "/api/agents/{agentId}/verify",
  },
  {
    contract: routeContract10,
    filePath: "src/app/api/agents/counts/route.contract.ts",
    routePath: "/api/agents/counts",
  },
  {
    contract: routeContract11,
    filePath: "src/app/api/agents/route.contract.ts",
    routePath: "/api/agents",
  },
  {
    contract: routeContract12,
    filePath: "src/app/api/api-key-status/route.contract.ts",
    routePath: "/api/api-key-status",
  },
  {
    contract: routeContract13,
    filePath: "src/app/api/credentials/check-connection/route.contract.ts",
    routePath: "/api/credentials/check-connection",
  },
  {
    contract: routeContract14,
    filePath: "src/app/api/credentials/issue/route.contract.ts",
    routePath: "/api/credentials/issue",
  },
  {
    contract: routeContract15,
    filePath: "src/app/api/credentials/issuer-oobi/route.contract.ts",
    routePath: "/api/credentials/issuer-oobi",
  },
  {
    contract: routeContract16,
    filePath: "src/app/api/credentials/reconcile/route.contract.ts",
    routePath: "/api/credentials/reconcile",
  },
  {
    contract: routeContract17,
    filePath: "src/app/api/credentials/schema-said/route.contract.ts",
    routePath: "/api/credentials/schema-said",
  },
  {
    contract: routeContract18,
    filePath: "src/app/api/credentials/status/route.contract.ts",
    routePath: "/api/credentials/status",
  },
  {
    contract: routeContract19,
    filePath: "src/app/api/credits/route.contract.ts",
    routePath: "/api/credits",
  },
  {
    contract: routeContract20,
    filePath: "src/app/api/dashboard/overview/route.contract.ts",
    routePath: "/api/dashboard/overview",
  },
  {
    contract: routeContract21,
    filePath: "src/app/api/earnings/agent/route.contract.ts",
    routePath: "/api/earnings/agent",
  },
  {
    contract: routeContract22,
    filePath: "src/app/api/earnings/agents/route.contract.ts",
    routePath: "/api/earnings/agents",
  },
  {
    contract: routeContract23,
    filePath: "src/app/api/earnings/route.contract.ts",
    routePath: "/api/earnings",
  },
  {
    contract: routeContract24,
    filePath: "src/app/api/health/route.contract.ts",
    routePath: "/api/health",
  },
  {
    contract: routeContract25,
    filePath: "src/app/api/masumi/inbox-agent/register/route.contract.ts",
    routePath: "/api/masumi/inbox-agent/register",
  },
  {
    contract: routeContract26,
    filePath: "src/app/api/register/email/route.contract.ts",
    routePath: "/api/register/email",
  },
  {
    contract: routeContract27,
    filePath: "src/app/api/v1/agents/[agentId]/route.contract.ts",
    routePath: "/api/v1/agents/{agentId}",
  },
  {
    contract: routeContract28,
    filePath: "src/app/api/v1/agents/route.contract.ts",
    routePath: "/api/v1/agents",
  },
  {
    contract: routeContract29,
    filePath: "src/app/api/v1/agents/verify/route.contract.ts",
    routePath: "/api/v1/agents/verify",
  },
  {
    contract: routeContract30,
    filePath: "src/app/credits/route.contract.ts",
    routePath: "/credits",
  },
  {
    contract: routeContract31,
    filePath:
      "src/app/pay/api/v1/inbox-agents/[inboxAgentId]/deregister/route.contract.ts",
    routePath: "/pay/api/v1/inbox-agents/{inboxAgentId}/deregister",
  },
  {
    contract: routeContract32,
    filePath:
      "src/app/pay/api/v1/inbox-agents/[inboxAgentId]/route.contract.ts",
    routePath: "/pay/api/v1/inbox-agents/{inboxAgentId}",
  },
  {
    contract: routeContract33,
    filePath: "src/app/pay/api/v1/inbox-agents/route.contract.ts",
    routePath: "/pay/api/v1/inbox-agents",
  },
] satisfies RouteContractManifestEntry[];
