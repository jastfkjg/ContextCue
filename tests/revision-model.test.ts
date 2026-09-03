import { describe, expect, it, vi } from "vitest";
import { generateWithModel, testModelConnection } from "../electron/services/model";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import { createVisionProbe } from "../electron/services/vision-probe";

describe("page-scoped revisions", () => {
  it("sends only the current screenshot, edited draft and instruction, with a single-candidate schema", async () => {
    const data = structuredClone(DEFAULT_DATA);
    data.documents[0].content = "OLD_PRIVATE_WINDOW";
    const fetcher = vi.fn(async () => Response.json({ output_text: JSON.stringify({ candidates: [{ text: "Friday works.", tone: "Direct", strategy: "Short" }] }) }));
    await generateWithModel(data, "test-key", { channel: "other", locale: "auto", quick: true, contextPolicy: "page-only", revision: { text: "My edited draft", instruction: "Make it shorter" } }, "data:image/png;base64,CURRENT_PAGE", fetcher as typeof fetch);
    const init = (fetcher.mock.calls as unknown as Array<[string, RequestInit]>)[0][1];
    const body = String(init.body);
    expect(body).toContain("CURRENT_PAGE");
    expect(body).toContain("My edited draft");
    expect(body).toContain("Make it shorter");
    expect(body).not.toContain("OLD_PRIVATE_WINDOW");
    expect(body).toContain('"maxItems":1');
    expect(init.signal).toBeDefined();
  });

  it("propagates user cancellation to the provider", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn(async (_url, init) => { init.signal.throwIfAborted(); return Response.json({}); });
    await expect(generateWithModel(structuredClone(DEFAULT_DATA), "test-key", { channel: "other", locale: "auto", quick: true }, "data:image/png;base64,current", fetcher as typeof fetch, controller.signal)).rejects.toThrow();
  });
});

describe("setup image verification", () => {
  const config = { ...DEFAULT_DATA.settings.models[0], apiKeyConfigured: true };
  it("creates a real PNG and keeps its answer out of the request", async () => {
    const probe = createVisionProbe();
    expect(Buffer.from(probe.imageDataUrl.split(",")[1], "base64").subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(probe.expectedAnswer.split(" ")).toHaveLength(6);
    const fetcher = vi.fn(async (_url, init) => {
      expect(String(init.body)).toContain(probe.imageDataUrl);
      expect(String(init.body)).not.toContain(probe.expectedAnswer);
      return Response.json({ output_text: probe.expectedAnswer });
    });
    expect((await testModelConnection(config, "test-key", fetcher as typeof fetch, probe)).message).toContain("verified");
  });
  it("does not call a text-only success an image-capable connection", async () => {
    await expect(testModelConnection(config, "test-key", (async () => Response.json({ output_text: "OK" })) as typeof fetch, createVisionProbe())).rejects.toThrow("did not read");
  });
});
