import { ZodError } from "zod";

export function convertZodError(error: ZodError): string {
  const errors = error.issues.map((issue) => issue.message);

  return errors.join(", ");
}
