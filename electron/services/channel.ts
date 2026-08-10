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

function normalizeWindowName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

export function namesReferToSameWindow(left: string, right: string): boolean {
  const first = normalizeWindowName(left);
  const second = normalizeWindowName(right);
  if (!first || !second) return false;
  if (first === second) return true;

  // Browser capture sources frequently omit (or add) a suffix such as
  // "- Google Chrome", while System Events reports the complete tab title.
  const shorter = first.length <= second.length ? first : second;
  const longer = first.length > second.length ? first : second;
  return shorter.length >= 3 && longer.includes(shorter);
}

export interface QuickReplyContext {
  applicationName: string;
  windowTitle: string;
  sourceName: string;
  channel: ChannelId;
}

export function frontmostMatchesQuickReplyContext(
  context: QuickReplyContext,
  applicationName: string,
  windowTitle = ""
): boolean {
  if (!applicationName.trim() && !windowTitle.trim()) return true;

  const sameApplication = namesReferToSameWindow(context.applicationName, applicationName);
  if (context.windowTitle && windowTitle) {
    return sameApplication && namesReferToSameWindow(context.windowTitle, windowTitle);
  }

  const currentChannel = detectChannel(`${applicationName} ${windowTitle}`);
  if (context.channel !== "other" && currentChannel !== "other") {
    return context.channel === currentChannel;
  }

  return sameApplication
    || namesReferToSameWindow(context.sourceName, windowTitle)
    || namesReferToSameWindow(context.sourceName, applicationName);
}

export function selectQuickReplySource<T extends Pick<CaptureSource, "id" | "name" | "channel">>(
  sources: T[],
  applicationName: string,
  windowTitle = ""
): T | undefined {
  // The front window title is the most precise signal for browser tabs and for
  // arbitrary apps whose capturer source is not named after the application.
  const titleMatch = sources.find((source) => namesReferToSameWindow(source.name, windowTitle));
  if (titleMatch) return titleMatch;

  const titleChannel = detectChannel(windowTitle);
  if (titleChannel !== "other") {
    const channelMatch = sources.find((source) => source.channel === titleChannel);
    if (channelMatch) return channelMatch;
  }

  const channel = detectChannel(applicationName);
  if (channel !== "other") return sources.find((source) => source.channel === channel);

  const applicationMatch = sources.find((source) => namesReferToSameWindow(source.name, applicationName));
  if (applicationMatch) return applicationMatch;

  // When only one non-ContextCue window is capturable it is safe and useful to use
  // it even if the OS could not expose its title (common on Linux/Wayland).
  if (sources.length === 1) return sources[0];
  if (!applicationName.trim() && !windowTitle.trim()) {
    return sources.find((source) => source.channel === "wechat");
  }
  return undefined;
}
