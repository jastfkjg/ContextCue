// Fictional, deterministic examples. No API requests or personal conversations.
export const examples = {
  en: {
    team: "Studio team", chat: "Team chat", person: "Jamie Chen", me: "You",
    project: "Design review", sidebar: ["Design review", "Product updates", "Team notes"],
    today: "Today · 9:41 AM", placeholder: "Write a message…",
    messages: [
      "Could we move the design review to Thursday at 2 pm?",
      "Thursday at 2 works for me.",
      "Perfect. Could you send the updated deck before we meet?"
    ],
    candidates: [
      "Thursday at 2 pm is confirmed. I’ll send you the updated deck before the review. Thanks for checking!",
      "Sounds good — Thursday at 2 pm. I’ll share the updated deck before we meet.",
      "All set for Thursday at 2 pm. You’ll have the updated deck ahead of the review."
    ],
    instruction: "Make it shorter and friendlier. Keep the meeting time.",
    revisions: [
      "Thursday at 2 it is! I’ll send the deck beforehand.",
      "See you Thursday at 2! I’ll share the deck before we meet.",
      "Sounds good, Thursday at 2. Deck coming your way before then!"
    ],
    question: "What do I need to do before the review?",
    answer: "**Send Jamie the updated deck before Thursday at 2 pm.**\n\n- The design review is now Thursday at 2 pm.\n- You’ve already confirmed the new time.\n- Jamie’s remaining request is the updated deck.",
    footer: "Fictional conversation · Actual ContextCue interface",
    label: "ContextCue · writing suggestions", askLabel: "ContextCue · Ask AI",
    scenes: {
      reply: { eyebrow: "01 / WRITE IN CONTEXT", title: "The right words. Right here.", subtitle: "Turn the conversation on your screen into a reply you can use.", tip: "Choose a reply. Copy it when you’re ready.", shortcut: "⌘ ⇧ Space" },
      revise: { eyebrow: "02 / MAKE IT YOURS", title: "A little shorter. A little warmer.", subtitle: "Tell ContextCue what to change, without starting over.", tip: "One instruction → multiple alternatives", shortcut: "⌘ / Ctrl + Enter" },
      ask: { eyebrow: "03 / ASK ABOUT THIS PAGE", title: "From conversation to clarity.", subtitle: "Ask a question using the page you already have open.", tip: "Page context is optional. You control what’s included.", shortcut: "⌘ ⇧ Enter" }
    }
  },
  "zh-CN": {
    team: "设计团队", chat: "团队会话", person: "林悦", me: "你",
    project: "设计评审", sidebar: ["设计评审", "产品动态", "团队笔记"],
    today: "今天 · 上午 9:41", placeholder: "输入消息…",
    messages: [
      "设计评审能改到周四下午两点吗？",
      "周四下午两点可以。",
      "好呀，开会前能把更新后的演示文稿发我吗？"
    ],
    candidates: [
      "那就定在周四下午两点。我会在评审前把更新后的演示文稿发给你，谢谢提醒！",
      "没问题，周四下午两点见！更新后的演示文稿会提前发你。",
      "已确认周四下午两点，评审前我会发出更新后的演示文稿。"
    ],
    instruction: "简短、亲切一点，保留开会时间。",
    revisions: [
      "周四下午两点见！演示文稿我会提前发你。",
      "好呀，周四下午两点见，文稿会提前发你！",
      "那就周四下午两点，演示文稿我提前发你～"
    ],
    question: "评审前我还需要做什么？",
    answer: "**在周四下午两点评审前，把更新后的演示文稿发给林悦。**\n\n- 设计评审已改到周四下午两点。\n- 你已经确认了新的时间。\n- 林悦还在等更新后的演示文稿。",
    footer: "虚构示例对话 · ContextCue 真实界面",
    label: "ContextCue · 写作建议", askLabel: "ContextCue · 页面问答",
    scenes: {
      reply: { eyebrow: "01 / 看懂上下文", title: "想说的话，就在当前窗口。", subtitle: "根据屏幕上的对话，给你几种合适的回复。", tip: "挑一条合适的，确认后再复制使用。", shortcut: "⌘ ⇧ Space" },
      revise: { eyebrow: "02 / 调整成你的语气", title: "短一点，亲切一点。", subtitle: "直接说出修改要求，不必从头再写。", tip: "一句修改要求，生成多个新候选", shortcut: "⌘ / Ctrl + Enter" },
      ask: { eyebrow: "03 / 直接问当前页面", title: "从一段对话，到清晰的下一步。", subtitle: "不用搬运上下文，就能针对当前页面提问。", tip: "可随时关闭页面上下文，由你决定是否使用。", shortcut: "⌘ ⇧ Enter" }
    }
  }
};
