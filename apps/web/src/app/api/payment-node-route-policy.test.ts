import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const API_ROOT = path.join(process.cwd(), "src/app/api");

function readRoute(relativePath: string): string {
  return fs.readFileSync(path.join(API_ROOT, relativePath), "utf8");
}

function listRouteFiles(relativeDir: string): string[] {
  const root = path.join(API_ROOT, relativeDir);
  const results: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.name === "route.ts") {
        results.push(path.relative(API_ROOT, fullPath));
      }
    }
  };
  visit(root);
  return results.sort();
}

describe("payment-node route API-key policy", () => {
  it("does not instantiate admin or raw payment-node clients outside registration exceptions", () => {
    const routeFiles = [
      ...listRouteFiles("v1"),
      ...listRouteFiles("agents"),
      ...listRouteFiles("masumi/inbox-agent"),
      ...listRouteFiles("registry-discovery"),
    ].filter(
      (routeFile) =>
        routeFile !== "v1/inbox-agents/route.ts" &&
        routeFile !== "v1/inbox-agents/[inboxAgentId]/route.ts" &&
        routeFile !== "v1/inbox-agents/[inboxAgentId]/deregister/route.ts" &&
        routeFile !== "registry-discovery/inbox-agent-identifier/route.ts",
    );

    for (const routeFile of routeFiles) {
      const source = readRoute(routeFile);
      expect(source, routeFile).not.toContain(
        "createInboxAdminPaymentNodeClient",
      );
      expect(source, routeFile).not.toContain("getAdminApiKey");
      expect(source, routeFile).not.toContain("createPaymentNodeClient(");
    }
  });

  it("allows inbox deregistration to use the admin client after ownership and scope checks", () => {
    const source = readRoute(
      "v1/inbox-agents/[inboxAgentId]/deregister/route.ts",
    );
    const ownershipCheck = source.indexOf(
      "const ownedInboxAgent = await getOwnedInboxAgentForUser",
    );
    const scopeCheck = source.indexOf("requireNetworkedOidcApiScope(");
    const adminClientCall = source.indexOf(
      "const client = createInboxAdminPaymentNodeClient()",
    );

    expect(source).toContain("createInboxAdminPaymentNodeClient");
    expect(ownershipCheck).toBeGreaterThanOrEqual(0);
    expect(scopeCheck).toBeGreaterThanOrEqual(0);
    expect(adminClientCall).toBeGreaterThanOrEqual(0);
    expect(scopeCheck).toBeLessThan(adminClientCall);
    expect(ownershipCheck).toBeLessThan(adminClientCall);
    expect(source).not.toContain("consumeCreditIfRequired");
    expect(source).not.toContain("refundConsumedCredit");
  });

  it("allows inbox registration to use the admin client without user wallet scoping", () => {
    const source = readRoute("v1/inbox-agents/route.ts");
    const apiScopeCheck = source.indexOf("requireNetworkedOidcApiScope(");
    const userPaymentNodeCheck = source.indexOf(
      "const userPaymentNodeClient = await getPaymentNodeClientForUser",
    );
    const preparedRegistration = source.indexOf(
      "const managedRegistration = await prepareManagedInboxRegistration",
    );
    const adminClientCall = source.indexOf(
      "const client = createInboxAdminPaymentNodeClient()",
    );

    expect(source).toContain("createInboxAdminPaymentNodeClient");
    expect(apiScopeCheck).toBeGreaterThanOrEqual(0);
    expect(userPaymentNodeCheck).toBeGreaterThanOrEqual(0);
    expect(preparedRegistration).toBeGreaterThanOrEqual(0);
    expect(adminClientCall).toBeGreaterThanOrEqual(0);
    expect(apiScopeCheck).toBeLessThan(adminClientCall);
    expect(userPaymentNodeCheck).toBeLessThan(adminClientCall);
    expect(adminClientCall).toBeLessThan(preparedRegistration);
    expect(source).not.toContain("ensureUserPaymentNodeKeyScopedToWallets");
    expect(source).not.toContain("RemoveSellingWallets");
  });

  it("allows inbox delete to use the admin client after ownership and state checks", () => {
    const source = readRoute("v1/inbox-agents/[inboxAgentId]/route.ts");
    const ownershipCheck = source.indexOf(
      "const ownedInboxAgent = await getOwnedInboxAgentForUser",
    );
    const stateCheck = source.indexOf(
      'inboxAgent.state !== "RegistrationFailed"',
    );
    const adminClientCall = source.indexOf(
      "const client = createInboxAdminPaymentNodeClient()",
    );

    expect(source).toContain("createInboxAdminPaymentNodeClient");
    expect(ownershipCheck).toBeGreaterThanOrEqual(0);
    expect(stateCheck).toBeGreaterThanOrEqual(0);
    expect(adminClientCall).toBeGreaterThanOrEqual(0);
    expect(ownershipCheck).toBeLessThan(adminClientCall);
    expect(stateCheck).toBeLessThan(adminClientCall);
  });

  it("keeps payment-node v1 proxy routes on the user payment-node token", () => {
    const paymentNodeProxyRoutes = [
      "v1/payment/route.ts",
      "v1/payment/authorize-refund/route.ts",
      "v1/payment/count/route.ts",
      "v1/payment/diff/route.ts",
      "v1/payment/diff/next-action/route.ts",
      "v1/payment/diff/onchain-state-or-result/route.ts",
      "v1/payment/error-state-recovery/route.ts",
      "v1/payment/income/route.ts",
      "v1/payment/resolve-blockchain-identifier/route.ts",
      "v1/payment/submit-result/route.ts",
      "v1/payment-source/route.ts",
      "v1/registry/agent-identifier/route.ts",
      "v1/registry/count/route.ts",
      "v1/registry/deregister/route.ts",
      "v1/registry/diff/route.ts",
      "v1/registry/route.ts",
    ];

    for (const routeFile of paymentNodeProxyRoutes) {
      expect(readRoute(routeFile), routeFile).toContain(
        "resolvePaymentUserTokenUpstream",
      );
    }
  });

  it("allows inbox-agent metadata lookup to use the admin client after registered ownership and scope checks", () => {
    const source = readRoute(
      "registry-discovery/inbox-agent-identifier/route.ts",
    );
    const scopeCheck = source.indexOf("requireNetworkedOidcApiScope(");
    const ownershipCheck = source.indexOf(
      "await getRegisteredOwnedInboxAgentReferenceByAgentIdentifier",
    );
    const adminClientCall = source.indexOf(
      "const client = createInboxAdminPaymentNodeClient()",
    );

    expect(source).toContain("createInboxAdminPaymentNodeClient");
    expect(source).toContain(
      "getRegisteredOwnedInboxAgentReferenceByAgentIdentifier",
    );
    expect(source).not.toContain("getPaymentNodeClientForUser");
    expect(scopeCheck).toBeGreaterThanOrEqual(0);
    expect(ownershipCheck).toBeGreaterThanOrEqual(0);
    expect(adminClientCall).toBeGreaterThanOrEqual(0);
    expect(scopeCheck).toBeLessThan(adminClientCall);
    expect(ownershipCheck).toBeLessThan(adminClientCall);
    expect(readRoute("masumi/inbox-agent/register/route.ts")).toContain(
      'export { POST } from "../../../v1/inbox-agents/route"',
    );
  });
});
