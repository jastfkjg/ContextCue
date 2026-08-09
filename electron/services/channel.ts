import type { CaptureSource, ChannelId } from "../../src/shared/types";

const CHANNEL_PATTERNS: Array<[ChannelId, RegExp]> = [
  ["wechat", /(wechat|微信)/i],
  ["slack", /slack/i],
  ["lark", /(lark|feishu|飞书)/i],
  ["gmail", /(gmail|google mail)/i],
  ["teams", /(microsoft teams|teams)/i],
  ["whatsapp", /whatsapp/i]
];

export function detectChannel(sourceName: string): ChannelId {
  return CHANNEL_PATTERNS.find(([, pattern]) => pattern.test(sourceName))?.[0] ?? "other";
}

export function targetApplicationName(channel: ChannelId): string | undefined {
  const names: Partial<Record<ChannelId, string>> = {
    wechat: "WeChat",
    slack: "Slack",
    lark: "Lark",
    teams: "Microsoft Teams",
    whatsapp: "WhatsApp"
  };
  return names[channel];
}

export function selectQuickReplySource<T extends Pick<CaptureSource, "id" | "name" | "channel">>(sources: T[], applicationName: string): T | undefined {
  const channel = detectChannel(applicationName);
  if (channel !== "other") return sources.find((source) => source.channel === channel);
  const normalizedName = applicationName.trim().toLowerCase();
  if (normalizedName) {
    const nameMatch = sources.find((source) => source.name.toLowerCase().includes(normalizedName));
    if (nameMatch) return nameMatch;
    return undefined;
  }
  return sources.find((source) => source.channel === "wechat");
}
