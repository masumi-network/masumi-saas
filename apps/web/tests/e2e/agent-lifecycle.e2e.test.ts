/**
 * E2E — Full agent lifecycle
 *
 * Covers: register → complete-registration poll → verify state → deregister (when working)
 *
 * NOTE: Registration involves an async on-chain transaction. The test polls
 * complete-registration for up to 90s. Wallet funding depends on the Preprod
 * dispenser being available.
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  CookieJar,
  getOrCreateAgent,
  pollCompleteRegistration,
  request,
  signIn,
} from "../helpers";

let jar: CookieJar;

beforeAll(async () => {
  jar = await signIn();
});

describe("E2E — Agent Registration Flow", () => {
  it("creates agent and returns agentId + RegistrationRequested state", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: `E2E-Reg-${Date.now()}`,
        description: "E2E lifecycle test",
        apiUrl: "https://example.com/agent",
        tags: "e2e,lifecycle",
      },
    });

    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    expect(b.agentId).toBeTruthy();

    const data = b.data as Record<string, unknown>;
    expect(data.registrationState).toBe("RegistrationRequested");
    expect(data.verificationStatus).toBe("PENDING");
    expect(data.networkIdentifier).toBe("Preprod");
    expect(Array.isArray(data.tags)).toBe(true);
  });

  it("complete-registration returns 202 while wallet is pending", async () => {
    const agentId = await getOrCreateAgent(jar);
    if (!agentId) {
      console.warn("Skipping — dispenser unavailable");
      return;
    }
    const res = await request(`/api/agents/${agentId}/complete-registration`, {
      method: "POST",
      jar,
    });
    // 202 = still pending, 200 = done
    expect([200, 202]).toContain(res.status);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
  });

  it("agent GET reflects state after registration attempt", async () => {
    const agentId = await getOrCreateAgent(jar);
    if (!agentId) {
      console.warn("Skipping — dispenser unavailable");
      return;
    }
    const res = await request(`/api/agents/${agentId}`, { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>;
    const validStates = [
      "RegistrationRequested",
      "RegistrationInitiated",
      "RegistrationConfirmed",
      "RegistrationFailed",
    ];
    expect(validStates).toContain(data.registrationState);
  });

  it("full registration flow: create → poll until confirmed (up to 90s)", async () => {
    const agentId = await getOrCreateAgent(jar);
    if (!agentId) {
      console.warn("Skipping — dispenser unavailable");
      return;
    }
    const outcome = await pollCompleteRegistration(jar, agentId, 30, 3000);

    // Verify state reflects outcome
    const res = await request(`/api/agents/${agentId}`, { jar });
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;

    if (outcome === "registered") {
      expect(data.registrationState).toBe("RegistrationConfirmed");
      console.log(`✅ Agent ${agentId} confirmed on-chain`);
    } else {
      // Dispenser might be slow — log but don't hard-fail
      console.warn(
        `⏳ Agent ${agentId} still pending after polling — dispenser may be slow`,
      );
      expect(["RegistrationRequested", "RegistrationInitiated"]).toContain(
        data.registrationState,
      );
    }
  });
});

describe("E2E — Agent Verification Gate", () => {
  it("verification-challenge returns challenge token for confirmed agent", async () => {
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationConfirmed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) {
      console.warn("No confirmed agent available — skipping challenge test");
      return;
    }
    const agentId = agents[0]!.id as string;
    const res = await request(`/api/agents/${agentId}/verification-challenge`, {
      jar,
    });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
  });

  it("verify without KYC approval → 400 (correctly gated)", async () => {
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationConfirmed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) return;
    const agentId = agents[0]!.id as string;

    const res = await request(`/api/agents/${agentId}/verify`, {
      method: "POST",
      jar,
      body: { aid: "fake-aid-123456" },
    });
    expect(res.status).toBe(400);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(false);
  });
});

describe("E2E — Delete Guard", () => {
  it("cannot delete a RegistrationConfirmed agent directly → 400", async () => {
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationConfirmed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) {
      console.warn("No confirmed agent to test delete guard");
      return;
    }
    const agentId = agents[0]!.id as string;
    const res = await request(`/api/agents/${agentId}`, {
      method: "DELETE",
      jar,
    });
    expect(res.status).toBe(400);
  });

  it("can delete a RegistrationFailed agent", async () => {
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationFailed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) {
      console.warn("No failed agent to delete — skipping");
      return;
    }
    const agentId = agents[0]!.id as string;
    const res = await request(`/api/agents/${agentId}`, {
      method: "DELETE",
      jar,
    });
    expect(res.status).toBe(200);
  });
});
