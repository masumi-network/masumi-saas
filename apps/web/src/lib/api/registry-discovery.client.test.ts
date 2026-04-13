import { afterEach, describe, expect, it, vi } from "vitest";

import { registryDiscoveryClient } from "./registry-discovery.client";

describe("registryDiscoveryClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps the normal registry-entry route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            entries: [
              {
                id: "entry-1",
                name: "Agent One",
              },
            ],
          },
          status: "success",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await registryDiscoveryClient.getRegistryEntries({
      network: "Preprod",
      limit: 1,
      filter: { status: ["Online"] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/registry-entry",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(result).toStrictEqual({
      success: true,
      data: {
        items: [
          {
            id: "entry-1",
            name: "Agent One",
          },
        ],
        nextCursor: "entry-1",
      },
    });
  });

  it("wraps the internal inbox-agent-registration route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            registrations: [
              {
                id: "inbox-1",
                name: "Inbox Agent",
                status: "Verified",
              },
            ],
          },
          status: "success",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await registryDiscoveryClient.getInboxAgentRegistrations({
      network: "Preprod",
      limit: 1,
      filter: { status: ["Verified"] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/registry-discovery/inbox-agent-registrations",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(result).toStrictEqual({
      success: true,
      data: {
        items: [
          {
            id: "inbox-1",
            name: "Inbox Agent",
            status: "Verified",
          },
        ],
        nextCursor: "inbox-1",
      },
    });
  });
});
