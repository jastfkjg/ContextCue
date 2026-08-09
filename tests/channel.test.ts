import { describe, expect, it } from "vitest";
import { detectChannel, selectQuickReplySource } from "../electron/services/channel";
import type { CaptureSource } from "../src/shared/types";

describe("detectChannel", () => {
  it.each([
    ["微信 — 林悦", "wechat"],
    ["WeChat", "wechat"],
    ["Slack | product-team", "slack"],
    ["飞书 - 方圆", "lark"],
    ["Lark", "lark"],
    ["Microsoft Teams", "teams"],
    ["Inbox (3) - Gmail", "gmail"],
    ["Notes", "other"]
  ])("maps %s to %s", (title, expected) => {
    expect(detectChannel(title)).toBe(expected);
  });
});

describe("selectQuickReplySource", () => {
  const sources: CaptureSource[] = [
    { id: "wechat", name: "WeChat — Lin Yue", thumbnail: "", channel: "wechat" },
    { id: "slack", name: "Slack — product-team", thumbnail: "", channel: "slack" }
  ];

  it("selects the visible source that matches the frontmost chat app", () => {
    expect(selectQuickReplySource(sources, "WeChat")?.id).toBe("wechat");
    expect(selectQuickReplySource(sources, "Slack")?.id).toBe("slack");
  });

  it("falls back to WeChat when the OS cannot report the frontmost app", () => {
    expect(selectQuickReplySource(sources, "")?.id).toBe("wechat");
  });
});
