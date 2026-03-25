/**
 * E2E — Rate limiting
 * Sends bursts to the public API and verifies 429 is triggered.
 */

import { describe, it, expect } from "vitest";
import { request, sleep } from "../helpers";

describe("E2E — Public API rate limiting", () => {
  it("triggers 429 after exceeding limit (60 req/min)", async () => {
    // Fire 65 sequential requests as fast as possible
    let got429 = false;
    let trigger = -1;
    for (let i = 0; i < 65; i++) {
      const res = await request("/api/v1/agents");
      if (res.status === 429) {
        got429 = true;
        trigger = i + 1;
        break;
      }
    }
    expect(got429).toBe(true);
    console.log(`Rate limit 429 triggered on request #${trigger}`);
  }, 60_000);

  it("recovers after rate limit window (wait 65s)", async () => {
    // wait for window to reset
    console.log("Waiting 65s for rate limit window to reset...");
    await sleep(65_000);
    const res = await request("/api/v1/agents");
    expect(res.status).toBe(200);
  }, 90_000);
});
