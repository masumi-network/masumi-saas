/**
 * Thin wrapper around @hookform/resolvers/zod that suppresses a type-level
 * incompatibility between @hookform/resolvers@5.x and Zod v4.1+.
 *
 * The resolver works correctly at runtime — the bundled types just check
 * for Zod version.minor === 0, which fails on v4.1+.
 */
import { zodResolver as _zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

export function zodResolver<T extends FieldValues>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<T, any, any>,
): Resolver<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _zodResolver(schema as any) as Resolver<T>;
}
