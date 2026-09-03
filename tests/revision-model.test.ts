import { describe, expect, it, vi } from "vitest";
import { generateWithModel, testModelConnection } from "../electron/services/model";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import { createVisionProbe } from "../electron/services/vision-probe";

describe("page-scoped revisions", () => {
  it("sends only the current screenshot, edited draft and instruction, with the configured candidate count", async () => {
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
    expect(body).toContain(`"maxItems":${data.settings.candidateCount}`);
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

describe("progressive revision results", () => {
  const request = { channel: "other", locale: "auto", quick: true, contextPolicy: "page-only", revision: { text: "Current draft", instruction: "Shorter" } } as const;
  const encoder = new TextEncoder();
  const sse = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\r\n\r\n`);

  it.each(["responses", "chat-completions"] as const)("shows completed candidates before the %s stream ends, including split SSE and escaped Unicode text", async (protocol) => {
    const data = structuredClone(DEFAULT_DATA);
    data.settings.models[0].apiProtocol = protocol;
    const seen: string[] = [];
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const fetcher = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } }), { headers: { "content-type": "text/event-stream" } }));
    const emit = (text: string) => {
      const bytes = sse(protocol === "responses" ? { type: "response.output_text.delta", delta: text } : { choices: [{ delta: { content: text } }] });
      for (let i = 0; i < bytes.length; i += 3) stream.enqueue(bytes.slice(i, i + 3));
    };
    const pending = generateWithModel(data, "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch, undefined, (candidate) => seen.push(candidate.text));
    await vi.waitFor(() => expect(stream).toBeDefined());
    emit('{"candidates":[{"text":"周五 {可以}，他说\\"好的\\"。"');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(seen).toEqual([]);
    emit(',"action":"insert"},');
    await vi.waitFor(() => expect(seen).toEqual(['周五 {可以}，他说"好的"。']));
    emit('{"text":"Second complete candidate"},{"text":"unfinished');
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    emit(' third candidate"}]}');
    const usage = protocol === "responses" ? { input_tokens: 20, output_tokens: 50, total_tokens: 70 } : { prompt_tokens: 20, completion_tokens: 50, total_tokens: 70 };
    stream.enqueue(sse(protocol === "responses" ? { type: "response.completed", response: { usage, status: "completed" } } : { choices: [], usage }));
    stream.close();
    const result = await pending;
    expect(result.candidates.map((item) => item.text)).toEqual(seen);
    expect(result.tokenUsage).toMatchObject({ totalTokens: 70, reported: true });
    expect(seen).toHaveLength(3);
    const body = JSON.parse(String((fetcher.mock.calls as unknown as Array<[string, RequestInit]>)[0][1].body));
    expect(body.stream).toBe(true);
    if (protocol === "chat-completions") expect(body.stream_options.include_usage).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never shows an incomplete candidate even when its text field is already closed", async () => {
    const seen: string[] = [];
    const partial = '{"candidates":[{"text":"Complete"},{"text":"Must not appear","tone":"unfinished';
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(sse({ type: "response.output_text.delta", delta: partial })); controller.close();
    } }), { headers: { "content-type": "text/event-stream" } }));
    const result = await generateWithModel(structuredClone(DEFAULT_DATA), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch, undefined, (candidate) => seen.push(candidate.text));
    expect(seen).toEqual(["Complete"]);
    expect(result.candidates).toHaveLength(1);
  });

  it("falls back to validated JSON when a provider ignores stream and deduplicates results", async () => {
    const fetcher = vi.fn(async () => Response.json({ output_text: JSON.stringify({ candidates: [{ text: "One" }, { text: "Two" }, { text: " one " }] }) }));
    const seen: string[] = [];
    const result = await generateWithModel(structuredClone(DEFAULT_DATA), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch, undefined, (candidate) => seen.push(candidate.text));
    expect(seen).toEqual(["One", "Two"]);
    expect(result.candidates).toHaveLength(2);
  });

  it("stops delivering candidates after cancellation during a stream", async () => {
    const controller = new AbortController();
    const onCandidate = vi.fn(() => controller.abort());
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(stream) {
      stream.enqueue(sse({ type: "response.output_text.delta", delta: '{"candidates":[{"text":"First"},' }));
      stream.enqueue(sse({ type: "response.output_text.delta", delta: '{"text":"Late"}]}' }));
      stream.close();
    } }), { headers: { "content-type": "text/event-stream" } }));
    await expect(generateWithModel(structuredClone(DEFAULT_DATA), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch, controller.signal, onCandidate)).rejects.toThrow();
    expect(onCandidate).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("surfaces a provider error after a partial group without retrying or treating it as success", async () => {
    const onCandidate = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(stream) {
      stream.enqueue(sse({ type: "response.output_text.delta", delta: '{"candidates":[{"text":"First"},' }));
      stream.enqueue(sse({ type: "response.failed", response: { error: { message: "Provider disconnected" } } }));
      stream.close();
    } }), { headers: { "content-type": "text/event-stream" } }));
    await expect(generateWithModel(structuredClone(DEFAULT_DATA), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch, undefined, onCandidate)).rejects.toThrow("Provider disconnected");
    expect(onCandidate).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
