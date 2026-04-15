import { NextResponse } from "next/server";

import { z } from "@/lib/zod-openapi";

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type OpenApiDocumentKey = "public-v1" | "platform";
export type SecurityRequirementObject = Record<string, string[]>;

export type RouteContractRequest = {
  params?: any;
  query?: any;
  headers?: any;
  body?: {
    required?: boolean;
    description?: string;
    content: {
      "application/json": {
        schema: z.ZodType;
      };
    };
  };
};

export type RouteContractResponse = {
  description: string;
  content?: {
    "application/json": {
      schema: z.ZodType;
    };
  };
};

export type RouteOperationContract = {
  summary?: string;
  description?: string;
  tags?: string[];
  security?: SecurityRequirementObject[];
  operationId?: string;
  request?: RouteContractRequest;
  responses: Partial<
    Record<number | `${number}` | "default", RouteContractResponse>
  >;
};

export type RouteContract = {
  documents: OpenApiDocumentKey[];
  tags?: string[];
  operations: Partial<Record<HttpMethod, RouteOperationContract>>;
};

export type RouteContractManifestEntry = {
  contract: RouteContract;
  filePath: string;
  routePath: string;
};

export function defineRouteContract<const T extends RouteContract>(
  contract: T,
): T {
  return contract;
}

export function jsonRequestBody(
  schema: z.ZodType,
  options?: {
    description?: string;
    required?: boolean;
  },
): NonNullable<RouteContractRequest["body"]> {
  return {
    required: options?.required,
    description: options?.description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

export function jsonResponse(
  description: string,
  schema: z.ZodType,
): RouteContractResponse {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

export function noContentResponse(description: string): RouteContractResponse {
  return {
    description,
  };
}

export function getOperationContract(
  contract: RouteContract,
  method: HttpMethod,
): RouteOperationContract {
  const operation = contract.operations[method];
  if (!operation) {
    throw new Error(`Missing route contract for ${method}`);
  }
  return operation;
}

function getResponseContract(
  contract: RouteContract,
  method: HttpMethod,
  status: number,
): RouteContractResponse {
  const operation = getOperationContract(contract, method);
  const responses = operation.responses as Record<
    string,
    RouteContractResponse | undefined
  >;
  const response = responses[String(status)];
  if (!response) {
    throw new Error(`Missing response contract for ${method} ${status}`);
  }
  return response;
}

export function getJsonResponseSchema(
  contract: RouteContract,
  method: HttpMethod,
  status: number,
): z.ZodType | null {
  return (
    getResponseContract(contract, method, status).content?.["application/json"]
      .schema ?? null
  );
}

function buildFallbackInternalErrorBody(
  contract: RouteContract,
  method: HttpMethod,
) {
  const body = {
    success: false,
    error: "Response validation failed",
  };
  const internalSchema = getJsonResponseSchema(contract, method, 500);
  if (!internalSchema) {
    return body;
  }
  const parsed = internalSchema.safeParse(body);
  return parsed.success ? parsed.data : body;
}

function normalizeJsonBody(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonBody(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeJsonBody(item),
      ]),
    );
  }
  return value;
}

export function contractJsonResponse(
  contract: RouteContract,
  method: HttpMethod,
  status: number,
  body: unknown,
  init?: Omit<ResponseInit, "status">,
): NextResponse {
  const schema = getJsonResponseSchema(contract, method, status);
  if (!schema) {
    throw new Error(`Expected JSON response schema for ${method} ${status}`);
  }

  const normalizedBody = normalizeJsonBody(body);
  const parsed = schema.safeParse(normalizedBody);
  if (!parsed.success) {
    console.error(
      `OpenAPI response validation failed for ${method} ${status}:`,
      parsed.error.flatten(),
    );
    return NextResponse.json(buildFallbackInternalErrorBody(contract, method), {
      ...init,
      status: 500,
    });
  }

  return NextResponse.json(parsed.data, {
    ...init,
    status,
  });
}

export function contractErrorResponse(
  contract: RouteContract,
  method: HttpMethod,
  status: number,
  error: string,
  details?: unknown,
  init?: Omit<ResponseInit, "status">,
): NextResponse {
  return contractJsonResponse(
    contract,
    method,
    status,
    details === undefined
      ? { success: false, error }
      : { success: false, error, details },
    init,
  );
}

export function contractNoContentResponse(
  contract: RouteContract,
  method: HttpMethod,
  status: number,
  init?: Omit<ResponseInit, "status">,
): Response {
  const response = getResponseContract(contract, method, status);
  if (response.content) {
    throw new Error(
      `Expected no-content response contract for ${method} ${status}`,
    );
  }

  return new Response(null, {
    ...init,
    status,
  });
}

export async function parseJsonRequestBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
) {
  const body = await request.json().catch(() => null);
  return schema.safeParse(body);
}

export function parseSearchParams<TSchema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: TSchema,
) {
  return schema.safeParse(Object.fromEntries(searchParams.entries()));
}

export function parseRequestHeaders<TSchema extends z.ZodType>(
  headers: Headers,
  schema: TSchema,
) {
  return schema.safeParse(Object.fromEntries(headers.entries()));
}

export function parseRouteParams<TSchema extends z.ZodType>(
  params: unknown,
  schema: TSchema,
) {
  return schema.safeParse(params);
}
