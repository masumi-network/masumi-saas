/**
 * One-off x402 rail smoke test (service layer + optional HTTP).
 * Usage: pnpm --filter @masumi/payment-source-x402 build && node scripts/x402-smoke.mjs
 */
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

process.env.X402_ENCRYPTION_KEY ??= "dev-x402-smoke-encryption-key-32ch!";

const BASE_SEPOLIA = "eip155:84532";
const USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const PAY_TO = "0x1111111111111111111111111111111111111111";
const AMOUNT = "10000"; // 0.01 USDC (6 decimals)

const results = [];

function pass(step, detail) {
  results.push({ step, ok: true, detail });
  console.log(`✓ ${step}: ${detail}`);
}

function fail(step, detail) {
  results.push({ step, ok: false, detail });
  console.error(`✗ ${step}: ${detail}`);
}

async function ensureOrgApiKey(prisma, userId) {
  const member = await prisma.member.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  let organizationId = member?.organizationId;
  if (!organizationId) {
    const org = await prisma.organization.create({
      data: {
        name: "x402 Smoke Org",
        slug: `x402-smoke-${Date.now()}`,
      },
    });
    await prisma.member.create({
      data: { userId, organizationId: org.id, role: "owner" },
    });
    organizationId = org.id;
  }

  const existing = await prisma.orgApiKey.findFirst({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.orgApiKey.create({
    data: {
      name: "x402-smoke-key",
      keyHash: `smoke_${randomBytes(32).toString("hex")}`,
      keyPrefix: "x402smok",
      organizationId,
      createdById: userId,
    },
    select: { id: true },
  });
  return created.id;
}

async function runServiceSmoke() {
  const prisma = (await import("@masumi/database/client")).default;
  const service = await import("@masumi/payment-source-x402/service");
  const { replaceSupportedPaymentSourcesForAgent } =
    await import("@masumi/payment-source-x402/supported-payment-sources");
  const { SupportedPaymentSourceChain } =
    await import("@masumi/payment-source-x402/payment-source");
  const { X402EvmWalletType } = await import("@masumi/database");

  const user = await prisma.user.findFirst({
    where: { emailVerified: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("No verified user in DB");
  pass("setup", `user ${user.email} (${user.id})`);

  const orgApiKeyId = await ensureOrgApiKey(prisma, user.id);
  pass("org-api-key", orgApiKeyId);

  const agent = await prisma.agent.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!agent) throw new Error("No agent for user — create one in UI first");
  pass("agent", agent.id);

  const network = await service.upsertX402Network({
    userId: user.id,
    caip2Id: BASE_SEPOLIA,
    displayName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    isTestnet: true,
    isEnabled: true,
    defaultAsset: USDC_SEPOLIA,
  });
  pass("upsert-network", network.caip2Id);

  const sellingWallet = await service.createX402ManagedWallet({
    userId: user.id,
    type: X402EvmWalletType.Selling,
    note: "x402-smoke facilitator",
  });
  pass("selling-wallet", sellingWallet.address);

  await service.upsertX402Network({
    userId: user.id,
    caip2Id: BASE_SEPOLIA,
    displayName: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    isTestnet: true,
    isEnabled: true,
    defaultAsset: USDC_SEPOLIA,
    facilitatorWalletId: sellingWallet.id,
  });
  pass("wire-facilitator", sellingWallet.id);

  await replaceSupportedPaymentSourcesForAgent(agent.id, [
    {
      chain: SupportedPaymentSourceChain.EVM,
      network: BASE_SEPOLIA,
      paymentSourceType: null,
      address: PAY_TO,
      scheme: "Exact",
      asset: USDC_SEPOLIA,
      amount: AMOUNT,
      decimals: 6,
      payTo: PAY_TO,
      resource: "https://smoke.example/run",
      extra: { assetTransferMethod: "permit2" },
    },
  ]);

  const source = await prisma.supportedPaymentSource.findFirst({
    where: { agentId: agent.id, chain: "EVM" },
    select: { id: true },
  });
  if (!source) throw new Error("supported payment source not persisted");
  pass("supported-source", source.id);

  const requirements = {
    scheme: "exact",
    network: BASE_SEPOLIA,
    asset: USDC_SEPOLIA,
    amount: AMOUNT,
    payTo: PAY_TO,
    maxTimeoutSeconds: 300,
    extra: { assetTransferMethod: "permit2", decimals: 6 },
  };

  const invalidPayload = {
    x402Version: 2,
    resource: { url: "https://smoke.example/run" },
    accepted: requirements,
    payload: {
      signature: "0x" + "ab".repeat(65),
      authorization: { nonce: "0x01", value: AMOUNT },
    },
  };

  const verify = await service.verifyX402Payment({
    userId: user.id,
    caip2NetworkLimit: null,
    supportedPaymentSourceId: source.id,
    paymentPayload: invalidPayload,
  });
  if (verify.verifyResponse.isValid) {
    fail("verify-invalid-payload", "expected isValid:false");
  } else {
    pass(
      "verify-invalid-payload",
      `facilitator rejected (${verify.verifyResponse.invalidReason ?? "no reason"})`,
    );
  }

  const purchasingWallet = await service.createX402ManagedWallet({
    userId: user.id,
    type: X402EvmWalletType.Purchasing,
    note: "x402-smoke buyer",
  });
  pass("purchasing-wallet", purchasingWallet.address);

  await service.setX402WalletBudget({
    userId: user.id,
    orgApiKeyId,
    evmWalletId: purchasingWallet.id,
    caip2Network: BASE_SEPOLIA,
    asset: USDC_SEPOLIA,
    remainingAmount: "1000000",
  });
  pass("set-budget", "1000000 units");

  const paymentRequired = {
    x402Version: 2,
    resource: { url: "https://smoke.example/run" },
    accepts: [requirements],
  };

  try {
    const outbound = await service.createX402Payment({
      userId: user.id,
      orgApiKeyId,
      caip2NetworkLimit: null,
      evmWalletId: purchasingWallet.id,
      paymentRequired,
    });
    pass(
      "outbound-pay",
      `attempt=${outbound.attemptId} payer=${outbound.payer} headerLen=${outbound.xPaymentHeader.length}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      e && typeof e === "object" && "statusCode" in e ? e.statusCode : "";
    fail("outbound-pay", `${status} ${msg}`);
  }

  const wallets = await service.listX402ManagedWallets({
    userId: user.id,
    take: 10,
  });
  pass("list-wallets", `${wallets.Wallets.length} wallet(s)`);

  return { userId: user.id, orgApiKeyId };
}

async function runHttpSmoke() {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:2999";
  try {
    const health = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!health.ok) {
      fail("http-health", `status ${health.status}`);
      return;
    }
    pass("http-health", base);
  } catch (e) {
    fail(
      "http-server",
      `not reachable at ${base} (${e instanceof Error ? e.message : e})`,
    );
    return;
  }

  const email = `x402-smoke-${Date.now()}@example.com`;
  const password = "Str0ngPass!123";
  const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ name: "x402 smoke", email, password }),
  });
  if (!signUp.ok) {
    fail("http-signup", `${signUp.status} ${await signUp.text()}`);
    return;
  }

  const prisma = (await import("@masumi/database/client")).default;
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  const jar = new Map();
  const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email, password }),
  });
  for (const c of signIn.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  if (!signIn.ok) {
    fail("http-signin", `${signIn.status}`);
    return;
  }
  pass("http-signin", email);

  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const listNet = await fetch(`${base}/api/v1/x402/networks`, {
    headers: { Cookie: cookie },
  });
  const listBody = await listNet.json();
  if (!listNet.ok) {
    fail("http-list-networks", `${listNet.status} ${JSON.stringify(listBody)}`);
    return;
  }
  pass("http-list-networks", `${listBody.Networks?.length ?? 0} network(s)`);
}

console.log("=== x402 smoke (service layer) ===\n");
await runServiceSmoke();

console.log("\n=== x402 smoke (HTTP) ===\n");
await runHttpSmoke();

console.log("\n=== summary ===");
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  process.exitCode = 1;
}
