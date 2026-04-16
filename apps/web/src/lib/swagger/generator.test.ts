import { describe, expect, it } from "vitest";

import { generateOpenAPISpec } from "./public-openapi-generator";

describe("generateOpenAPISpec", () => {
  it("uses explicit runtime paths for the public discovery surface", () => {
    const spec = generateOpenAPISpec();

    expect(spec.paths["/api/v1/agents"]).toBeDefined();
    expect(spec.paths["/api/v1/agents/{agentId}"]).toBeDefined();
    expect(spec.paths["/api/v1/agents/verify"]).toBeDefined();
    expect(spec.paths["/agents"]).toBeUndefined();
  });
});
