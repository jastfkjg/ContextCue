import { describe, expect, it } from "vitest";
import { AskOutput } from "../electron/services/ask-output";

describe("Ask output routing", () => {
  it("streams normal Markdown unchanged", () => {
    const visible: string[] = [];
    const output = new AskOutput((delta) => visible.push(delta));
    for (const chunk of ["**Hello", "**\n", "世界"]) output.push(chunk);
    expect(output.finish("**Hello**\n世界")).toBeNull();
    expect(visible.join("")).toBe("**Hello**\n世界");
  });
  it.each(["\n", "\r\n"])("hides the draft envelope across every split with newline %j", (newline) => {
    const text = `CONTEXTCUE_DRAFT${newline}{"candidates":[{"text":"你好"}]}`;
    for (let split = 0; split <= text.length; split++) {
      const visible: string[] = [];
      const output = new AskOutput((delta) => visible.push(delta));
      output.push(text.slice(0, split)); output.push(text.slice(split));
      expect(output.finish(text)).toBe('{"candidates":[{"text":"你好"}]}');
      expect(visible.join("")).toBe("");
    }
  });
  it("does not route marker-like prose as a draft", () => {
    const visible: string[] = [];
    const output = new AskOutput((delta) => visible.push(delta));
    output.push("CONTEXT"); output.push(" is useful.");
    expect(output.finish("CONTEXT is useful.")).toBeNull();
    expect(visible.join("")).toBe("CONTEXT is useful.");
  });
});
