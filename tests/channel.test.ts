import { describe, expect, it } from "vitest";
import { detectChannel } from "../electron/services/channel";

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
