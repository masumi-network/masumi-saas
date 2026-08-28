type LogContext = Record<string, unknown>;

const REDACTED = "[REDACTED]";

/**
 * Scrub credentials that RPC/provider errors commonly embed: path-style API
 * keys (`.../v2/<key>`) and credential-ish query params. viem errors echo the
 * full request URL, and x402 RPC URLs frequently carry provider keys.
 */
function redactSecretsInString(value: string): string {
  return value
    .replace(/(\/v[0-9]+\/)[A-Za-z0-9_-]{16,}/g, `$1${REDACTED}`)
    .replace(
      /([?&](?:api[_-]?key|apikey|key|token|secret|auth|password)=)[^&#\s"']+/gi,
      `$1${REDACTED}`,
    );
}

function redactValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactSecretsInString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecretsInString(value.message),
      ...(value.stack ? { stack: redactSecretsInString(value.stack) } : {}),
    };
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = redactValue(val, seen);
    }
    return out;
  }
  return value;
}

export const logger = {
  error(message: string, context?: LogContext): void {
    console.error(message, context ? redactValue(context) : "");
  },
  warn(message: string, context?: LogContext): void {
    console.warn(message, context ? redactValue(context) : "");
  },
};
