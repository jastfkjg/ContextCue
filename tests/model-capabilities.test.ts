import { describe, expect, it } from "vitest";
import { inferImageInputSupport } from "../src/shared/model-capabilities";

describe("inferImageInputSupport", () => {
  it("marks DeepSeek text models as unable to read screenshots", () => {
    expect(inferImageInputSupport("deepseek-v4-flash")).toBe(false);
    expect(inferImageInputSupport("deepseek-chat")).toBe(false);
    expect(inferImageInputSupport("deepseek-reasoner")).toBe(false);
  });

  it("keeps explicitly visual model IDs enabled", () => {
    expect(inferImageInputSupport("deepseek-vl2")).toBe(true);
    expect(inferImageInputSupport("qwen3-vl")).toBe(true);
    expect(inferImageInputSupport("gpt-5.6-luna")).toBe(true);
  });
});
