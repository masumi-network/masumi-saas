export type AuthErrorResult<TKey extends string = string> = {
  error: string;
  errorKey: TKey;
};

type AuthErrorMatcher<TResult extends AuthErrorResult = AuthErrorResult> = {
  matches: (message: string) => boolean;
  result: TResult;
};

export function isInfrastructureError(message: string) {
  return (
    message.includes("denied access") ||
    message.includes("database") ||
    message.includes("connection") ||
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
  if (!(error instanceof Error)) {
    return createUnexpectedErrorResult();
  }

  const errorMessage = error.message.toLowerCase();
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
