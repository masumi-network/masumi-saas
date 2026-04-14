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

  it("wraps the public registry-entry-search route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            entries: [
              {
                id: "entry-2",
                name: "Agent Search Result",
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

    const result = await registryDiscoveryClient.searchRegistryEntries({
      network: "Preprod",
      query: "search result",
      limit: 1,
      filter: { status: ["Online"] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/registry-entry-search",
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
            id: "entry-2",
            name: "Agent Search Result",
          },
        ],
        nextCursor: "entry-2",
      },
    });
  });

  it("forwards an abort signal to registry search requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            entries: [],
          },
          status: "success",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const controller = new AbortController();

    vi.stubGlobal("fetch", fetchMock);

    await registryDiscoveryClient.searchRegistryEntries(
      {
        network: "Preprod",
        query: "search result",
        limit: 1,
        filter: { status: ["Online"] },
      },
      { signal: controller.signal },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/registry-entry-search",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
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

  it("wraps the public inbox-agent-registration-search route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            registrations: [
              {
                id: "inbox-2",
                name: "Inbox Agent",
                linkedEmail: "agent@example.com",
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

    const result = await registryDiscoveryClient.searchInboxAgentRegistrations({
      network: "Preprod",
      query: "agent@example.com",
      limit: 1,
      filter: { status: ["Verified"] },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/inbox-agent-registration-search",
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
            id: "inbox-2",
            name: "Inbox Agent",
            linkedEmail: "agent@example.com",
          },
        ],
        nextCursor: "inbox-2",
      },
    });
  });

  it("forwards an abort signal to inbox-agent search requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            registrations: [],
          },
          status: "success",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const controller = new AbortController();

    vi.stubGlobal("fetch", fetchMock);

    await registryDiscoveryClient.searchInboxAgentRegistrations(
      {
        network: "Preprod",
        query: "agent@example.com",
        limit: 1,
        filter: { status: ["Verified"] },
      },
      { signal: controller.signal },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/inbox-agent-registration-search",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("rethrows aborted inbox browse requests", async () => {
    const abortError = new DOMException(
      "The operation was aborted.",
      "AbortError",
    );
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      registryDiscoveryClient.getInboxAgentRegistrations({
        network: "Preprod",
        limit: 1,
        filter: { status: ["Verified"] },
      }),
    ).rejects.toBe(abortError);
  });
});
