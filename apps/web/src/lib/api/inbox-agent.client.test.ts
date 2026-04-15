import { afterEach, describe, expect, it, vi } from "vitest";

import { inboxAgentApiClient } from "./inbox-agent.client";

describe("inboxAgentApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps the inbox-agent list route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ id: "inbox-1", name: "Support inbox" }],
          nextCursor: "inbox-1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inboxAgentApiClient.getInboxAgents(
      {
        filterStatus: "Registered",
        search: "support",
      },
      {
        take: 1,
        network: "Preprod",
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/pay/api/v1/inbox-agents?filterStatus=Registered&search=support&take=1&network=Preprod",
      expect.objectContaining({
        credentials: "include",
      }),
    );
    expect(result).toStrictEqual({
      success: true,
      data: [{ id: "inbox-1", name: "Support inbox" }],
      nextCursor: "inbox-1",
    });
  });

  it("wraps the inbox-agent register route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: "inbox-1", name: "Support inbox" },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await inboxAgentApiClient.registerInboxAgent(
      {
        name: "Support inbox",
        agentSlug: "support-inbox",
      },
      {
        network: "Preprod",
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/pay/api/v1/inbox-agents?network=Preprod",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          name: "Support inbox",
          agentSlug: "support-inbox",
        }),
      }),
    );
    expect(result).toStrictEqual({
      success: true,
      data: { id: "inbox-1", name: "Support inbox" },
    });
  });
});
