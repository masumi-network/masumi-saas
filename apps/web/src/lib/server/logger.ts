/**
 * Server-side logging entry point. Prefer this over ad-hoc `console.*` so sinks
 * (structured logging, Sentry, etc.) can be wired in one place later.
 *
 * Pass `Error` values as `err` (not `String(err)`) so Node logs retain stacks.
 */
type LogMeta = Record<string, unknown> | undefined;

export const serverLog = {
  error(message: string, meta?: LogMeta) {
    if (meta !== undefined) {
      console.error(message, meta);
    } else {
      console.error(message);
    }
  },

  warn(message: string, meta?: LogMeta) {
    if (meta !== undefined) {
      console.warn(message, meta);
    } else {
      console.warn(message);
    }
  },
};
