/**
 * Shared test helpers — cookie-based auth, request wrapper, agent lifecycle utils.
 * All tests run against the real running server at BASE_URL.
 */

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export const TEST_EMAIL = process.env.TEST_EMAIL ?? "admin@masumi.network";
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Admin@12345";

// ─── Cookie jar ─────────────────────────────────────────────────────────────

export class CookieJar {
  private cookies: Map<string, string> = new Map();

  ingestAll(cookies: string[]) {
    for (const cookie of cookies) {
      const [pair] = cookie.trim().split(";");
      if (!pair) continue;
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  clear() {
    this.cookies.clear();
  }
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

type RequestOptions = {
  method?: string;
  body?: unknown;
  jar?: CookieJar;
  headers?: Record<string, string>;
};

export async function request(
  path: string,
  { method = "GET", body, jar, headers = {} }: RequestOptions = {},
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
      ...(jar ? { Cookie: jar.header() } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (jar)
    jar.ingestAll(
      res.headers.getSetCookie?.() ??
        res.headers.get("set-cookie")?.split(/,(?=[^ ])/) ??
        [],
    );

  let parsed: unknown;
  const ct = res.headers.get("content-type") ?? "";
  try {
    parsed = ct.includes("json") ? await res.json() : await res.text();
  } catch {
    parsed = null;
  }

  return { status: res.status, body: parsed, headers: res.headers };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function signIn(
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
): Promise<CookieJar> {
  const jar = new CookieJar();
  const res = await request("/api/auth/sign-in/email", {
    method: "POST",
    body: { email, password },
    jar,
  });
  if (res.status !== 200) {
    throw new Error(
      `Sign-in failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return jar;
}

// ─── Agent helpers ────────────────────────────────────────────────────────────

let agentCounter = 0;

export function uniqueAgentName(prefix = "Test") {
  return `${prefix}-${Date.now()}-${++agentCounter}`;
}

export async function createAgent(
  jar: CookieJar,
  overrides: Record<string, unknown> = {},
  retries = 3,
): Promise<string | undefined> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: uniqueAgentName(),
        description: "Automated test agent",
        apiUrl: "https://example.com/test-agent",
        tags: "test,automated",
        ...overrides,
      },
    });
    const b = res.body as Record<string, unknown>;
    if (b.agentId) return b.agentId as string;
    if (attempt < retries) {
      const delay = attempt * 4000;
      console.warn(
        `createAgent attempt ${attempt} failed (${b.error}), retrying in ${delay}ms…`,
      );
      await sleep(delay);
    } else {
      throw new Error(
        `createAgent failed after ${retries} attempts: ${JSON.stringify(b)}`,
      );
    }
  }
}

/** Try to get an existing agent id, or create a new one as fallback. */
export async function getOrCreateAgent(jar: CookieJar): Promise<string | null> {
  const listRes = await request("/api/agents?network=Preprod&take=1", { jar });
  const agents = (listRes.body as Record<string, unknown>).data as Record<
    string,
    unknown
  >[];
  if (agents.length > 0) return agents[0]!.id as string;
  try {
    return (await createAgent(jar)) ?? null;
  } catch {
    return null;
  }
}

export async function pollCompleteRegistration(
  jar: CookieJar,
  agentId: string,
  maxAttempts = 30,
  delayMs = 3000,
): Promise<"registered" | "timeout"> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await request(`/api/agents/${agentId}/complete-registration`, {
      method: "POST",
      jar,
    });
    if (res.status === 200) return "registered";
    if (res.status !== 202) return "timeout";
    if (i < maxAttempts - 1) await sleep(delayMs);
  }
  return "timeout";
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
