import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodResolver } from "@/lib/form-zod-resolver";
import { updateAgentDetailsBodySchema } from "@/lib/schemas/agent";

import { editAgentExampleOutputsSchema } from "./edit-agent-example-outputs";

const blank = { name: "", url: "", mimeType: "" };
const valid = {
  name: "Result",
  url: "https://example.com/result.json",
  mimeType: "application/json",
};

describe("edit agent example outputs", () => {
  it("removes blank rows from the reviewed and submitted values", () => {
    const reviewed = editAgentExampleOutputsSchema.parse([blank, valid, blank]);
    expect(reviewed).toEqual([valid]);
    const submitted = updateAgentDetailsBodySchema.parse({
      name: "Changed name",
      apiUrl: "https://example.com/agent",
      tags: "test",
      exampleOutputs: reviewed,
    });
    expect(submitted.exampleOutputs).toEqual(reviewed);
  });

  it("removes whitespace-only rows", () => {
    expect(
      editAgentExampleOutputsSchema.parse([
        { name: " ", url: "\n", mimeType: "\t" },
      ]),
    ).toEqual([]);
  });

  it("keeps the original row index in form field errors", async () => {
    const schema = z.object({ exampleOutputs: editAgentExampleOutputsSchema });
    const resolver = zodResolver<z.infer<typeof schema>>(schema);
    const result = await resolver(
      { exampleOutputs: [blank, valid, { ...valid, url: "invalid" }] },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(result.values).toEqual({});
    expect(result.errors.exampleOutputs?.[2]?.url?.message).toBe("Invalid URL");
    expect(result.errors.exampleOutputs?.[0]).toBeUndefined();
  });

  it("requires every field in a partly filled row", () => {
    const result = editAgentExampleOutputsSchema.safeParse([
      { name: "Result", url: "", mimeType: "" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          [0, "url"],
          [0, "mimeType"],
        ]),
      );
    }
  });

  it("retains the server limits for complete rows", () => {
    const result = editAgentExampleOutputsSchema.safeParse([
      { ...valid, name: "a".repeat(61), mimeType: "b".repeat(61) },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          [0, "name"],
          [0, "mimeType"],
        ]),
      );
    }
  });
});
