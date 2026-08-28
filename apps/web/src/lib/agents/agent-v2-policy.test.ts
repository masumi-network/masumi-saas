import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGENT_FLOW_PATHS = [
  join(__dirname, "../agent-registration.ts"),
  join(__dirname, "wallet-ownership.ts"),
  join(__dirname, "../../app/api/agents/route.ts"),
];

describe("saas agent v2 policy", () => {
  it("does not call V1 registry list filters in active agent flows", () => {
    for (const path of AGENT_FLOW_PATHS) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain('filterPaymentSourceType: "Web3CardanoV1"');
      expect(source).not.toContain("Web3CardanoV1");
    }
  });
});
