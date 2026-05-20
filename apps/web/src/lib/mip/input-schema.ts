import { z } from "zod";

const inputTypes = [
  "none",
  "string",
  "text",
  "textarea",
  "number",
  "boolean",
  "email",
  "password",
  "tel",
  "url",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "color",
  "range",
  "file",
  "hidden",
  "search",
  "checkbox",
  "radio",
  "option",
  "multiselect",
] as const;

export type MipInputType = (typeof inputTypes)[number];

export type MipInputField = {
  id: string;
  type: MipInputType;
  name: string;
  data?: Record<string, unknown> | null;
  validations?: unknown[] | null;
};

export type MipInputSchema =
  | { input_data: MipInputField[] }
  | {
      input_groups: Array<{
        id: string;
        title: string;
        input_data: MipInputField[];
      }>;
    };

const inputFieldSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(inputTypes),
    name: z.string().min(1),
    data: z.record(z.string(), z.unknown()).nullish(),
    validations: z.array(z.unknown()).nullish(),
  })
  .passthrough();

const inputDataSchema = z.object({
  input_data: z.array(inputFieldSchema),
});

const inputGroupsSchema = z.object({
  input_groups: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      input_data: z.array(inputFieldSchema),
    }),
  ),
});

const inputSchemaSchema = z.union([inputDataSchema, inputGroupsSchema]);

export const mipInputDataPayloadSchema = z.record(
  z.string(),
  z.union([
    z.number(),
    z.array(z.number()),
    z.string(),
    z.array(z.string()),
    z.boolean(),
    z.undefined(),
  ]),
);

export type MipInputDataPayload = z.infer<typeof mipInputDataPayloadSchema>;

function hasUniqueIds(fields: MipInputField[]): boolean {
  const ids = fields.map((field) => field.id);
  return new Set(ids).size === ids.length;
}

export function normalizeInputSchema(value: unknown): MipInputSchema | null {
  const objectResult = inputSchemaSchema.safeParse(value);
  if (objectResult.success) {
    const schema = objectResult.data as MipInputSchema;
    if ("input_data" in schema) {
      return hasUniqueIds(schema.input_data) ? schema : null;
    }
    const ids = schema.input_groups.flatMap((group) =>
      group.input_data.map((input) => input.id),
    );
    return new Set(ids).size === ids.length ? schema : null;
  }

  if (Array.isArray(value)) {
    const fieldsResult = z.array(inputFieldSchema).safeParse(value);
    if (fieldsResult.success && hasUniqueIds(fieldsResult.data)) {
      return { input_data: fieldsResult.data as MipInputField[] };
    }
  }

  return null;
}

export function getDefaultLangdockInputSchema(): MipInputSchema {
  return {
    input_data: [
      {
        id: "text",
        type: "textarea",
        name: "Prompt",
        data: {
          placeholder: "Describe the task",
          description: "Initial message for the Langdock agent",
        },
        validations: [{ validation: "optional", value: "false" }],
      },
    ],
  };
}

export function getLangdockHitlInputSchema(): MipInputSchema {
  return {
    input_data: [
      {
        id: "message",
        type: "textarea",
        name: "Message",
        data: {
          placeholder: "Reply to the agent",
          description: "Message to continue the conversation",
        },
        validations: [{ validation: "optional", value: "true" }],
      },
      {
        id: "finish",
        type: "boolean",
        name: "Finish",
        data: {
          default: false,
          description: "Submit the current conversation as final output",
        },
        validations: [{ validation: "optional", value: "true" }],
      },
    ],
  };
}
