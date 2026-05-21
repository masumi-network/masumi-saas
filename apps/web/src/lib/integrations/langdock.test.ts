import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultLangdockInputSchema } from "../mip/input-schema";
import { langdockInputFieldsToMipSchema, testLangdockAgent } from "./langdock";

describe("langdockInputFieldsToMipSchema", () => {
  it("falls back to the default prompt schema when Langdock has no usable fields", () => {
    expect(langdockInputFieldsToMipSchema(null)).toStrictEqual(
      getDefaultLangdockInputSchema(),
    );
    expect(langdockInputFieldsToMipSchema([null, "ignored"])).toStrictEqual(
      getDefaultLangdockInputSchema(),
    );
  });

  it("maps Langdock fields to MIP input fields with stable ids and validations", () => {
    const schema = langdockInputFieldsToMipSchema([
      {
        id: "Question",
        type: "text",
        label: "Question",
        placeholder: "Ask something",
        description: "Prompt for the agent",
        required: true,
      },
      {
        name: "Budget",
        fieldType: "integer",
        optional: false,
      },
      {
        key: "Priority",
        inputType: "dropdown",
        options: ["Low", { label: "High" }, { value: "Urgent" }],
      },
      {
        id: "Question",
        type: "mystery",
        title: "Duplicate question",
      },
    ]);

    expect(schema).toMatchObject({
      input_data: [
        {
          id: "question",
          type: "textarea",
          name: "Question",
          data: {
            placeholder: "Ask something",
            description: "Prompt for the agent",
          },
          validations: [{ validation: "optional", value: "false" }],
        },
        {
          id: "budget",
          type: "number",
          name: "Budget",
          validations: [{ validation: "optional", value: "false" }],
        },
        {
          id: "priority",
          type: "option",
          name: "Priority",
          data: { values: ["Low", "High", "Urgent"] },
          validations: [{ validation: "optional", value: "true" }],
        },
        {
          id: "question_4",
          type: "textarea",
          name: "Duplicate question",
        },
      ],
    });
  });
});

describe("testLangdockAgent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches agent metadata and sends a chat probe with the supplied credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "agent-1",
            name: "Research bot",
            inputFields: [{ id: "prompt", type: "text" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: " ok " } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const agent = await testLangdockAgent({
      apiKey: "ld_test",
      agentId: "agent-1",
      baseUrl: "https://langdock.example.com/api/",
    });

    expect(agent.name).toBe("Research bot");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://langdock.example.com/api/agent/v1/get?agentId=agent-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer ld_test",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://langdock.example.com/api/agent/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          agentId: "agent-1",
          messages: [
            {
              role: "user",
              content: "Masumi connection check. Reply with ok.",
            },
          ],
          stream: false,
        }),
      }),
    );
  });

  it("surfaces Langdock API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "bad key" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      ),
    );

    await expect(
      testLangdockAgent({ apiKey: "bad", agentId: "agent-1" }),
    ).rejects.toThrow("Langdock request failed: 401 bad key");
  });
});
