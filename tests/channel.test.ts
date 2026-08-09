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
    { id: "slack", name: "Slack — product-team", thumbnail: "", channel: "slack" },
    { id: "xiaohongshu", name: "AI创业18个月，我终于还是要滚去上班了", thumbnail: "", channel: "other" }
  ];

  it("selects the visible source that matches the frontmost chat app", () => {
    expect(selectQuickReplySource(sources, "WeChat")?.id).toBe("wechat");
    expect(selectQuickReplySource(sources, "Slack")?.id).toBe("slack");
  });

  it("falls back to WeChat when the OS cannot report the frontmost app", () => {
    expect(selectQuickReplySource(sources, "")?.id).toBe("wechat");
  });

  it("selects a browser page by its front window title", () => {
    expect(selectQuickReplySource(sources, "Google Chrome", "AI创业18个月，我终于还是要滚去上班了")?.id)
      .toBe("xiaohongshu");
  });

  it("matches browser title suffix differences", () => {
    expect(selectQuickReplySource(sources, "Arc", "AI创业18个月，我终于还是要滚去上班了 - 小红书")?.id)
      .toBe("xiaohongshu");
  });

  it("supports an arbitrary app when it is the only visible source", () => {
    const onlySource = [{ id: "notes", name: "Support conversation", thumbnail: "", channel: "other" as const }];
    expect(selectQuickReplySource(onlySource, "Unknown App")?.id).toBe("notes");
  });
});
