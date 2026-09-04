import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import { generateWithModel, streamAnswerWithModel } from "../electron/services/model";
import type { ApiProtocol } from "../src/shared/types";

for (const protocol of ["responses", "chat-completions"] as ApiProtocol[]) {
  describe(`Ask draft output via ${protocol}`, () => {
    const configuration = () => {
      const data = structuredClone(DEFAULT_DATA);
      data.settings.models[0].apiProtocol = protocol;
      return data;
    };
    const payload = (text: string) => protocol === "responses"
      ? { output: [{ content: [{ type: "output_text", text }] }] }
      : { choices: [{ message: { content: text } }] };
    const writing = 'CONTEXTCUE_DRAFT\n{"candidates":[{"text":"谢谢邀请，这次无法参加。","action":"replace-all"}],"scenario":"reply"}';
    it("returns usable candidates without exposing JSON in non-streaming fallbacks", async () => {
      const delta = vi.fn();
      const fetcher = vi.fn(async () => new Response(JSON.stringify(payload(writing)), { headers: { "content-type": "application/json" } }));
      const result = await streamAnswerWithModel(configuration(), "key", "帮我婉拒", "data:image/png;base64,test", [], undefined, delta, new AbortController().signal, fetcher);
      expect(result.draft?.candidates[0]).toMatchObject({ text: "谢谢邀请，这次无法参加。", action: "insert" });
      expect(result.answer).not.toContain("CONTEXTCUE");
      expect(delta).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it("routes split SSE writing output with Unicode", async () => {
      const chunks = Array.from(writing).map((text) => protocol === "responses"
        ? { type: "response.output_text.delta", delta: text }
        : { choices: [{ delta: { content: text } }] });
      const stream = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
      const delta = vi.fn();
      const result = await streamAnswerWithModel(configuration(), "key", "帮我婉拒", "", [], undefined, delta, new AbortController().signal,
        async () => new Response(stream, { headers: { "content-type": "text/event-stream" } }));
      expect(result.draft?.candidates).toHaveLength(1);
      expect(delta).not.toHaveBeenCalled();
    });
    it("surfaces malformed writing results without showing their envelope", async () => {
      const delta = vi.fn();
      await expect(streamAnswerWithModel(configuration(), "key", "Draft a reply", "", [], undefined, delta, new AbortController().signal,
        async () => new Response(JSON.stringify(payload('CONTEXTCUE_DRAFT\n{"candidates":[]}')), { headers: { "content-type": "application/json" } }))).rejects.toThrow();
      expect(delta).not.toHaveBeenCalled();
    });
    it("revises page-off drafts with text-only models and no image or page metadata", async () => {
      const data = configuration();
      data.settings.models[0].supportsImageInput = false;
      const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify(payload('{"candidates":[{"text":"Hello"}]}')), { headers: { "content-type": "application/json" } }));
      await generateWithModel(data, "key", { channel: "other", locale: "auto", contextPolicy: "page-only", withoutPageContext: true, revision: { text: "Hi there", instruction: "More formal" } }, "", fetcher);
      const body = String(fetcher.mock.calls[0][1]?.body);
      expect(body).not.toContain("input_image");
      expect(body).not.toContain("image_url");
      expect(body).toContain("Hi there");
    });
  });
}
