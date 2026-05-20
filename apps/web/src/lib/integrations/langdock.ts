import "server-only";

import { z } from "zod";

import {
  getDefaultLangdockInputSchema,
  type MipInputField,
  type MipInputSchema,
} from "@/lib/mip/input-schema";

const DEFAULT_LANGDOCK_BASE_URL = "https://api.langdock.com";
const LANGDOCK_TIMEOUT_MS = 20_000;

const langdockAgentSchema = z
  .object({
    id: z.string().optional(),
    agentId: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional().nullable(),
    emojiIcon: z.string().optional().nullable(),
    inputFields: z.array(z.unknown()).optional().nullable(),
  })
  .passthrough();

export type LangdockAgent = z.infer<typeof langdockAgentSchema>;

export type LangdockMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function normalizeLangdockBaseUrl(baseUrl?: string | null): string {
  const value = baseUrl?.trim() || DEFAULT_LANGDOCK_BASE_URL;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Langdock base URL must use http or https");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function langdockFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {},
  baseUrl?: string | null,
): Promise<unknown> {
  const base = normalizeLangdockBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LANGDOCK_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const message =
        json &&
        typeof json === "object" &&
        "message" in json &&
        typeof json.message === "string"
          ? json.message
          : response.statusText;
      throw new Error(`Langdock request failed: ${response.status} ${message}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLangdockAgent(params: {
  apiKey: string;
  agentId: string;
  baseUrl?: string | null;
}): Promise<LangdockAgent> {
  const json = await langdockFetch(
    params.apiKey,
    `/agent/v1/get?agentId=${encodeURIComponent(params.agentId)}`,
    { method: "GET" },
    params.baseUrl,
  );
  return langdockAgentSchema.parse(json);
}

function extractChatContent(value: unknown): string {
  const parsed = z
    .object({
      choices: z
        .array(
          z.object({
            message: z
              .object({
                content: z.string().optional(),
              })
              .optional(),
          }),
        )
        .optional(),
      message: z.string().optional(),
      content: z.string().optional(),
      output: z.string().optional(),
    })
    .passthrough()
    .safeParse(value);

  if (!parsed.success) return "";
  return (
    parsed.data.choices?.[0]?.message?.content ??
    parsed.data.message ??
    parsed.data.content ??
    parsed.data.output ??
    ""
  );
}

export async function completeLangdockChat(params: {
  apiKey: string;
  agentId: string;
  messages: LangdockMessage[];
  baseUrl?: string | null;
}): Promise<string> {
  const json = await langdockFetch(
    params.apiKey,
    "/agent/v1/chat/completions",
    {
      method: "POST",
      body: JSON.stringify({
        agentId: params.agentId,
        messages: params.messages,
        stream: false,
      }),
    },
    params.baseUrl,
  );
  const content = extractChatContent(json).trim();
  if (!content) {
    throw new Error("Langdock agent returned an empty response");
  }
  return content;
}

export async function testLangdockAgent(params: {
  apiKey: string;
  agentId: string;
  baseUrl?: string | null;
}): Promise<LangdockAgent> {
  const agent = await getLangdockAgent(params);
  await completeLangdockChat({
    ...params,
    messages: [
      {
        role: "user",
        content: "Masumi connection check. Reply with ok.",
      },
    ],
  });
  return agent;
}

function slugifyInputId(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function getInputFieldString(
  field: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = field[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function mapLangdockFieldType(type: string | null): MipInputField["type"] {
  switch (type?.toLowerCase()) {
    case "number":
    case "integer":
      return "number";
    case "boolean":
    case "bool":
    case "checkbox":
      return "boolean";
    case "select":
    case "option":
    case "dropdown":
      return "option";
    case "text":
    case "textarea":
    case "longtext":
    case "long_text":
      return "textarea";
    case "email":
      return "email";
    case "url":
      return "url";
    default:
      return "textarea";
  }
}

function getOptions(field: Record<string, unknown>): string[] {
  const source = field.options ?? field.values;
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const option = item as Record<string, unknown>;
        return getInputFieldString(option, ["value", "label", "name"]) ?? null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

export function langdockInputFieldsToMipSchema(
  inputFields: unknown,
): MipInputSchema {
  if (!Array.isArray(inputFields) || inputFields.length === 0) {
    return getDefaultLangdockInputSchema();
  }

  const usedIds = new Set<string>();
  const fields: MipInputField[] = inputFields
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null;
      const field = raw as Record<string, unknown>;
      const label =
        getInputFieldString(field, ["name", "label", "title", "id"]) ??
        `Field ${index + 1}`;
      const sourceId =
        getInputFieldString(field, ["id", "key", "name", "label"]) ??
        `field_${index + 1}`;
      let id = slugifyInputId(sourceId, `field_${index + 1}`);
      while (usedIds.has(id)) id = `${id}_${index + 1}`;
      usedIds.add(id);
      const type = mapLangdockFieldType(
        getInputFieldString(field, ["type", "fieldType", "inputType"]),
      );
      const options = getOptions(field);
      return {
        id,
        type,
        name: label,
        data: {
          placeholder: getInputFieldString(field, ["placeholder"]),
          description: getInputFieldString(field, ["description", "helpText"]),
          ...(type === "option" && options.length > 0
            ? { values: options }
            : {}),
        },
        validations: [
          {
            validation: "optional",
            value:
              field.required === true || field.optional === false
                ? "false"
                : "true",
          },
        ],
      } satisfies MipInputField;
    })
    .filter((field): field is MipInputField => field != null);

  return fields.length > 0
    ? { input_data: fields }
    : getDefaultLangdockInputSchema();
}
