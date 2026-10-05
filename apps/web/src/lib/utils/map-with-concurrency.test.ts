import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./map-with-concurrency";

describe("mapWithConcurrency", () => {
  it("keeps input order and never exceeds the limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency(
      [30, 5, 20, 1, 10],
      2,
      async (delay, index) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, delay));
        inFlight -= 1;
        return index;
      },
    );
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(maxInFlight).toBe(2);
  });

  it("returns an empty array for no items", async () => {
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });
});
