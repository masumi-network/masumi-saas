export type AuthErrorResult<TKey extends string = string> = {
  error: string;
  errorKey: TKey;
};

type AuthErrorBody = {
  message?: unknown;
  error?: unknown;
  error_description?: unknown;
  code?: unknown;
};

type AuthErrorMatcher<TResult extends AuthErrorResult = AuthErrorResult> = {
  matches: (message: string) => boolean;
  result: TResult;
};

export type AuthErrorDetails = {
  status?: number;
  message: string;
  messages: string[];
  body?: AuthErrorBody;
};

const STATUS_CODE_BY_NAME: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

function isAuthErrorBody(value: unknown): value is AuthErrorBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    return STATUS_CODE_BY_NAME[value];
  }

  return undefined;
}

function getStringDetail(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getAuthErrorDetails(error: unknown): AuthErrorDetails {
  const details: AuthErrorDetails = {
    message: "",
    messages: [],
  };

  if (!(error instanceof Error)) {
    return details;
  }

  const authError = error as Error & {
    status?: unknown;
    statusCode?: unknown;
    body?: unknown;
  };

  details.status =
    normalizeStatus(authError.statusCode) ?? normalizeStatus(authError.status);

  const body = isAuthErrorBody(authError.body) ? authError.body : undefined;
  details.body = body;

  const candidates = [
    getStringDetail(error.message),
    getStringDetail(body?.message),
    getStringDetail(body?.error_description),
    getStringDetail(body?.error),
    getStringDetail(body?.code),
  ].filter((value): value is string => Boolean(value));

  details.messages = [...new Set(candidates)];
  details.message = details.messages.join(" ").toLowerCase();
  return details;
}

export function isInfrastructureError(message: string) {
  return (
    message.includes("denied access") ||
    message.includes("database") ||
    message.includes("connection") ||
    message.includes("failed to create session") ||
    message.includes("not available")
  );
}

export function createUnexpectedErrorResult(): AuthErrorResult<"UnexpectedError"> {
  return {
    error: "An unexpected error occurred",
    errorKey: "UnexpectedError",
  };
}

export function createDatabaseErrorResult(): AuthErrorResult<"DatabaseError"> {
  return {
    error:
      "Database connection error. Please check your database configuration.",
    errorKey: "DatabaseError",
  };
}

export function classifyAuthError<TResult extends AuthErrorResult>(
  error: unknown,
  matchers: readonly AuthErrorMatcher<TResult>[],
): TResult | AuthErrorResult<"DatabaseError" | "UnexpectedError"> {
  const { message: errorMessage } = getAuthErrorDetails(error);
  if (!errorMessage) {
    return createUnexpectedErrorResult();
  }

  if (isInfrastructureError(errorMessage)) {
    return createDatabaseErrorResult();
  }

  for (const matcher of matchers) {
    if (matcher.matches(errorMessage)) {
      return matcher.result;
    }
  }

  return createUnexpectedErrorResult();
}
