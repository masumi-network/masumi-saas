import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  network: "Preprod" as "Preprod" | "Mainnet",
  translate: (key: string) => key,
  notify: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
  pending: vi.fn(),
}));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useMemo: (callback: () => unknown) => callback(),
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => void) => {
    harness.effects.push(callback);
  },
}));
vi.mock("next-intl", () => ({ useTranslations: () => harness.translate }));
vi.mock("sonner", () => ({ toast: harness.notify }));
vi.mock("@/hooks/use-chain-registry-icons", () => ({
  useChainRegistryIcons: () => ({}),
}));
vi.mock("@/lib/context/agent-completion-context", () => ({
  useAgentCompletion: () => ({ addPendingRegistration: harness.pending }),
}));
vi.mock("@/lib/context/payment-network-context", () => ({
  usePaymentNetwork: () => ({ network: harness.network, setNetwork: vi.fn() }),
}));
vi.mock("@/lib/hooks/use-credit-balance", () => ({
  useCreditBalance: () => ({
    data: { creditsRemaining: 100 },
    isPending: false,
  }),
}));

import { useBatchRegisterX402Controller } from "./use-batch-register-x402-controller";

const url = "https://example.com/paid";
const probeResponse = () =>
  Response.json({
    success: true,
    row: { sokosumiCompatible: true, resource: url },
  });
const registeredResponse = () =>
  Response.json({ success: true, registeredResourceKeys: [] });
const batchResponse = () =>
  Response.json({
    success: true,
    results: [{ resourceUrl: url, status: "started", agentId: "old-agent" }],
    summary: { started: 1, skippedDuplicate: 0, failed: 0 },
  });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const props = { open: true, onClose: vi.fn(), onSuccess: vi.fn() };
function renderController(overrides = {}) {
  harness.cursor = 0;
  harness.effects = [];
  // eslint-disable-next-line react-hooks/rules-of-hooks -- React hooks are mocked by the state harness above.
  return useBatchRegisterX402Controller({ ...props, ...overrides });
}
async function settle() {
  for (let i = 0; i < 8; i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  harness.slots = [];
  harness.network = "Preprod";
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("batch registration controller", () => {
  it("keeps custom tags during automatic probing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse()),
    );
    renderController({ initialUrlText: url, initialExtraTags: "custom-tag" });
    harness.effects.forEach((effect) => effect());
    await settle();
    expect(
      renderController().rows[0]?.metadata?.tagsText.split(", "),
    ).toContain("custom-tag");
  });
  it("marks rejected probes failed and clears loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(registeredResponse()),
    );
    await renderController()
      .runProbes(url)
      .catch(() => {});
    expect(renderController().isProbing).toBe(false);
    expect(renderController().rows[0]?.status).toBe("error");
  });
  it("clears loading when duplicate lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    await renderController()
      .runProbes(url)
      .catch(() => {});
    expect(renderController().isProbing).toBe(false);
  });
  it("tracks successful closed-session submissions without replacing dialog state", async () => {
    const response = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse())
        .mockReturnValueOnce(response.promise),
    );
    await renderController().runProbes(url);
    const submit = renderController().submitBatch();
    renderController().handleClose();
    renderController();
    response.resolve(batchResponse());
    await submit;
    expect(renderController().step).toBe("paste");
    expect(renderController().results).toEqual([]);
    expect(harness.pending).toHaveBeenCalledWith("old-agent");
    expect(props.onSuccess).toHaveBeenCalledOnce();
    expect(harness.notify.success).not.toHaveBeenCalled();
  });
  it("ignores old probe updates after a new operation", async () => {
    const response = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(response.promise)
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValue(registeredResponse()),
    );
    const oldProbe = renderController().runProbes(url);
    renderController().handleClose();
    await renderController().runProbes(url);
    renderController().saveRowMetadata(url, {
      name: "new",
      description: "",
      tagsText: "new",
    });
    response.resolve(probeResponse());
    await oldProbe;
    expect(renderController().rows[0]?.metadata?.name).toBe("new");
  });
  it("invalidates pending probes when the network changes and preserves input", async () => {
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(response.promise));
    renderController().setUrlText(url);
    const oldProbe = renderController().runProbes();
    harness.network = "Mainnet";
    renderController();
    harness.effects.forEach((effect) => effect());
    response.resolve(probeResponse());
    await oldProbe;
    expect(renderController().rows).toEqual([]);
    expect(renderController().isProbing).toBe(false);
    expect(renderController().urlText).toBe(url);
  });
  it("keeps the latest submission loading when an older response arrives", async () => {
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse())
        .mockReturnValueOnce(oldResponse.promise)
        .mockReturnValueOnce(newResponse.promise),
    );
    await renderController().runProbes(url);
    const oldSubmit = renderController().submitBatch();
    const newSubmit = renderController().submitBatch();
    oldResponse.resolve(batchResponse());
    await oldSubmit;
    expect(renderController().isSubmitting).toBe(true);
    expect(renderController().step).toBe("review");
    newResponse.resolve(batchResponse());
    await newSubmit;
    expect(renderController().step).toBe("results");
    expect(props.onSuccess).toHaveBeenCalledTimes(2);
  });
  it("reports a rejected submission and clears loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse())
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );
    await renderController().runProbes(url);
    await renderController().submitBatch();
    expect(renderController().isSubmitting).toBe(false);
    expect(harness.notify.error).toHaveBeenCalledWith("submitFailed");
  });
  it("keeps distinct resource paths when merging a JSON import", async () => {
    renderController().setUrlText("https://example.com/Paid");
    await renderController().handleJsonImport({
      size: 50,
      name: "resources.json",
      text: async () => JSON.stringify(["https://example.com/paid"]),
    } as File);
    expect(renderController().parsedPreview.urls).toHaveLength(2);
  });
  it("tracks successful submissions after a network switch without restoring old results", async () => {
    const response = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse())
        .mockReturnValueOnce(response.promise),
    );
    await renderController().runProbes(url);
    const submit = renderController().submitBatch();
    harness.network = "Mainnet";
    renderController();
    harness.effects.forEach((effect) => effect());
    response.resolve(batchResponse());
    await submit;
    expect(harness.pending).toHaveBeenCalledWith("old-agent");
    expect(props.onSuccess).toHaveBeenCalledOnce();
    expect(renderController().step).toBe("paste");
    expect(renderController().results).toEqual([]);
    expect(harness.notify.success).not.toHaveBeenCalled();
  });
  it("refreshes the current network after an older network submission succeeds", async () => {
    const oldRefresh = vi.fn();
    const currentRefresh = vi.fn();
    const response = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(probeResponse())
        .mockResolvedValueOnce(registeredResponse())
        .mockReturnValueOnce(response.promise),
    );
    await renderController({ onSuccess: oldRefresh }).runProbes(url);
    const submit = renderController({ onSuccess: oldRefresh }).submitBatch();
    harness.network = "Mainnet";
    renderController({ onSuccess: currentRefresh });
    harness.effects.forEach((effect) => effect());
    response.resolve(batchResponse());
    await submit;
    expect(currentRefresh).toHaveBeenCalledOnce();
    expect(oldRefresh).not.toHaveBeenCalled();
    expect(harness.pending).toHaveBeenCalledWith("old-agent");
    expect(renderController().results).toEqual([]);
  });
});
