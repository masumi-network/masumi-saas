import { afterEach, describe, expect, it, vi } from "vitest";

import * as fetchContactOobiModule from "@/lib/veridian/fetch-contact-oobi";
import { resolveHolderOobi } from "@/lib/veridian/resolve-holder-oobi";

describe("resolveHolderOobi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns stored OOBI without calling the credential server", async () => {
    const fetchSpy = vi.spyOn(fetchContactOobiModule, "fetchContactOobi");

    const result = await resolveHolderOobi({
      storedHolderOobi: "https://holder.example/oobi/EHOLDER",
      holderAid: "EHOLDER",
    });

    expect(result).toBe("https://holder.example/oobi/EHOLDER");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to credential server contacts by holder AID", async () => {
    vi.spyOn(fetchContactOobiModule, "fetchContactOobi").mockResolvedValue(
      "https://keria.example/oobi/EHOLDER/agent/witness",
    );

    const result = await resolveHolderOobi({
      storedHolderOobi: null,
      holderAid: "EHOLDER",
    });

    expect(result).toBe("https://keria.example/oobi/EHOLDER/agent/witness");
    expect(fetchContactOobiModule.fetchContactOobi).toHaveBeenCalledWith(
      "EHOLDER",
    );
  });

  it("returns null when neither stored OOBI nor AID is available", async () => {
    const fetchSpy = vi.spyOn(fetchContactOobiModule, "fetchContactOobi");

    expect(await resolveHolderOobi({})).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
