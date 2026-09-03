import "./styles.css";

const translations = {
  zh: {
    "meta.title": "ContextCue — 回复始终跟着当前对话",
    "meta.description": "ContextCue 是一款本地优先的 Mac 回复助手。停留在当前对话，按一下快捷键，得到自然、可直接使用的候选回复。",
    "meta.ogDescription": "无需切换窗口，让 ContextCue 在你正在输入的地方提供回复。",
    "skip": "跳到主要内容",
    "home.aria": "ContextCue 首页",
    "nav.aria": "主要导航",
    "nav.how": "如何工作",
    "nav.privacy": "隐私",
    "nav.install": "安装",
    "download.short": "下载测试版",
    "hero.title": "回复始终跟着<br />当前对话。",
    "hero.lede": "停留在微信、Slack、飞书或任何聊天窗口。按一下快捷键，ContextCue 就在输入框旁给出几条真正贴合上下文的回复。",
    "hero.download": "下载 Mac 测试版",
    "hero.how": "看看它如何工作",
    "hero.release": "当前为未经 Apple 公证的内测版 · Apple Silicon / Intel",
    "demo.aria": "ContextCue 在聊天窗口旁生成候选回复的产品界面演示",
    "demo.online": "在线",
    "demo.today": "今天 15:42",
    "demo.incoming1": "周四同一时间可以吗？",
    "demo.outgoing": "没问题，我看一下日程。",
    "demo.incoming2": "另外，可以在开会前把更新后的方案发给我吗？",
    "demo.composer": "输入消息…",
    "demo.switch": "切换",
    "demo.insert": "插入",
    "demo.caption": "只有主动按下快捷键后，ContextCue 才会读取当前窗口。",
    "signals.aria": "产品特点",
    "signals.invoke": "一次唤起",
    "signals.candidates": "多条候选",
    "signals.insert": "插入但不发送",
    "signals.local": "记忆留在本机",
    "workflow.title": "少一次切换，<br />多一点上下文。",
    "workflow.body": "ContextCue 不需要接管你的聊天工具。它只在需要时出现，完成后安静退回后台。",
    "workflow.one.title": "留在当前对话",
    "workflow.one.body": "把需要回复的聊天窗口放在最前面，不用复制粘贴，也不用跳去另一个 AI 页面。",
    "workflow.two.title": "按下全局快捷键",
    "workflow.two.body": "ContextCue 截取一次可见窗口，并组合与你、联系人和当前渠道相关的本地记忆。",
    "workflow.three.title": "选择，然后插入",
    "workflow.three.body": "在不同策略之间切换，把选中的回复放进输入框。发送之前，决定权始终在你手里。",
    "context.title": "不只改写一句话。<br />而是理解你在和谁说话。",
    "context.body": "ContextCue 会参考你明确保存的写作偏好、联系人关系和真正采用过的回复，让候选语气逐渐接近你。",
    "context.one": "匹配当前对话语言",
    "context.two": "区分不同回复策略",
    "context.three": "不把模型建议自动写进记忆",
    "context.aria": "三条不同回复策略的示例",
    "card.one.tone": "清晰 · 周到",
    "card.one.strategy": "同时确认两件事",
    "card.one.reply": "周四同一时间可以。我会更新日程，并在会前把新版方案发给你。",
    "card.one.action": "采用这条回复 ↗",
    "card.two.tone": "温和 · 简洁",
    "card.two.strategy": "简短确认",
    "card.two.reply": "周四可以。我会调整邀请，并在见面前把更新后的方案发给你。",
    "card.candidate": "候选回复",
    "card.three.tone": "平静 · 有条理",
    "card.three.strategy": "说明行动顺序",
    "card.three.reply": "周四同一时间没问题。我会先发新版方案，再更新日历邀请。",
    "privacy.title": "它只在你叫它时出现。",
    "privacy.body": "不是后台录屏，也不会自动发送。ContextCue 把边界做成产品行为，而不只是一段承诺。",
    "privacy.one.title": "主动触发",
    "privacy.one.body": "只有按下快捷键后才读取当前可见会话的一张截图。",
    "privacy.two.title": "本地记忆",
    "privacy.two.body": "个人资料、关系和偏好保存在本机，只选择本次需要的少量内容。",
    "privacy.three.title": "自选模型",
    "privacy.three.body": "截图会发送给你配置的视觉模型服务商，API Key 由系统钥匙串加密。",
    "privacy.four.title": "从不代发",
    "privacy.four.body": "候选回复只会插入输入框，最后的检查和发送永远由你完成。",
    "install.title": "先从 Mac 测试版开始。",
    "install.body": "当前为未经 Apple 公证的内测版，首次打开可能被 macOS 拦截。",
    "install.download": "前往下载",
    "install.detecting": "正在识别这台 Mac…",
    "install.mac": "已识别为 Mac · 点击下载后选择 Apple Silicon 或 Intel",
    "install.other": "当前版本仅支持 macOS · 下载选项提供 Apple Silicon 与 Intel 版本",
    "install.one.title": "安装应用",
    "install.one.body": "打开 DMG，把 ContextCue 拖入“应用程序”。",
    "install.two.title": "首次打开",
    "install.two.body": "如被拦截，前往“系统设置 → 隐私与安全性”查看“仍要打开”。若无此选项或仍提示损坏，请联系开发者。",
    "install.three.title": "允许权限",
    "install.three.body": "按引导开启屏幕录制与辅助功能权限，再回到 ContextCue。",
    "final.title": "别离开对话。<br />直接回复。",
    "footer.tagline": "回复始终跟着当前对话。",
    "footer.privacy": "隐私说明",
    "footer.install": "安装指南",
    "download.title": "选择你的 Mac",
    "download.description": "选择与你的 Mac 芯片对应的版本，下载将立即开始。",
    "download.close": "关闭下载选项",
    "download.arm.title": "Apple Silicon",
    "download.arm.body": "适用于搭载 M 系列芯片的 Mac",
    "download.intel.title": "Intel",
    "download.intel.body": "适用于搭载 Intel 处理器的 Mac",
    "download.unsigned": "未经 Apple 公证的内测版。首次启动如被拦截，请查看“隐私与安全性 → 仍要打开”；若无法放行，请联系开发者。",
    "download.all": "查看所有版本 ↗"
  },
  en: {
    "meta.title": "ContextCue — replies that stay with the conversation",
    "meta.description": "ContextCue is a local-first reply assistant for Mac. Stay in the conversation, press one shortcut, and get natural replies grounded in what is visible.",
    "meta.ogDescription": "Stay where you are typing and get replies that fit the conversation.",
    "skip": "Skip to main content",
    "home.aria": "ContextCue home",
    "nav.aria": "Main navigation",
    "nav.how": "How it works",
    "nav.privacy": "Privacy",
    "nav.install": "Install",
    "download.short": "Download beta",
    "hero.title": "Replies that stay<br />with the conversation.",
    "hero.lede": "Stay in WeChat, Slack, Lark, or any conversation. Press one shortcut and ContextCue places a few context-aware replies beside the input field.",
    "hero.download": "Download for Mac",
    "hero.how": "See how it works",
    "hero.release": "Not Apple notarized · Apple Silicon / Intel",
    "demo.aria": "Product demo showing ContextCue generating reply candidates beside a conversation",
    "demo.online": "Online",
    "demo.today": "Today 15:42",
    "demo.incoming1": "Could we move the sync to Thursday?",
    "demo.outgoing": "Sure — let me check my calendar.",
    "demo.incoming2": "Also, can you send the updated deck before we meet?",
    "demo.composer": "Write a message…",
    "demo.switch": "choose",
    "demo.insert": "insert",
    "demo.caption": "ContextCue reads the current window only after you press the shortcut.",
    "signals.aria": "Product highlights",
    "signals.invoke": "One shortcut",
    "signals.candidates": "Multiple replies",
    "signals.insert": "Insert, never send",
    "signals.local": "Memory stays local",
    "workflow.title": "Less switching.<br />More context.",
    "workflow.body": "ContextCue never takes over your chat app. It appears when you need it, then quietly returns to the background.",
    "workflow.one.title": "Stay in the conversation",
    "workflow.one.body": "Keep the conversation you want to answer in front. No copying, pasting, or switching to another AI page.",
    "workflow.two.title": "Press the global shortcut",
    "workflow.two.body": "ContextCue captures the visible window once and combines it with a small amount of relevant local memory.",
    "workflow.three.title": "Choose and insert",
    "workflow.three.body": "Move between different strategies and insert the reply you want. You always review and send it yourself.",
    "context.title": "More than a rewrite.<br />It knows who you are talking to.",
    "context.body": "ContextCue uses the writing preferences, relationships, and accepted replies you explicitly save, so suggestions gradually sound more like you.",
    "context.one": "Match the conversation language",
    "context.two": "Offer distinct reply strategies",
    "context.three": "Never turn model suggestions into memory",
    "context.aria": "Three examples of distinct reply strategies",
    "card.one.tone": "Clear · thoughtful",
    "card.one.strategy": "Confirm both requests",
    "card.one.reply": "Thursday at the same time works. I’ll update the invite and send the revised deck beforehand.",
    "card.one.action": "Use this reply ↗",
    "card.two.tone": "Warm · concise",
    "card.two.strategy": "Brief confirmation",
    "card.two.reply": "Thursday works. I’ll move the invite and get the updated deck to you before we meet.",
    "card.candidate": "Candidate reply",
    "card.three.tone": "Calm · structured",
    "card.three.strategy": "State the sequence",
    "card.three.reply": "Thursday at the same time works for me. I’ll share the updated deck first, then update the invite.",
    "privacy.title": "It appears only when you ask.",
    "privacy.body": "No background recording. No automatic sending. ContextCue makes privacy boundaries part of the product behavior.",
    "privacy.one.title": "You invoke it",
    "privacy.one.body": "It reads one screenshot of the visible conversation only after you press the shortcut.",
    "privacy.two.title": "Memory stays local",
    "privacy.two.body": "Your profile, relationships, and preferences remain on this Mac. Only a small relevant subset is selected.",
    "privacy.three.title": "Bring your model",
    "privacy.three.body": "The screenshot goes to the vision model provider you configure. Your API key is protected by the system keychain.",
    "privacy.four.title": "It never sends",
    "privacy.four.body": "ContextCue only inserts a candidate into the input field. You always review and send it yourself.",
    "install.title": "Start with the Mac beta.",
    "install.body": "This early-access build is not Apple notarized. macOS may block it on first launch.",
    "install.download": "Go to download",
    "install.detecting": "Detecting this device…",
    "install.mac": "Mac detected · choose Apple Silicon or Intel after clicking download",
    "install.other": "Currently available for macOS · Apple Silicon and Intel downloads are available",
    "install.one.title": "Install the app",
    "install.one.body": "Open the DMG and drag ContextCue into Applications.",
    "install.two.title": "Open it once",
    "install.two.body": "If blocked, check System Settings → Privacy & Security for Open Anyway. If unavailable or the app is still reported as damaged, contact the developer.",
    "install.three.title": "Allow access",
    "install.three.body": "Follow the prompts for Screen Recording and Accessibility, then return to ContextCue.",
    "final.title": "Stay in the conversation.<br />Reply right there.",
    "footer.tagline": "Replies that stay with the conversation.",
    "footer.privacy": "Privacy",
    "footer.install": "Install guide",
    "download.title": "Choose your Mac",
    "download.description": "Select the build that matches your Mac. The download will start immediately.",
    "download.close": "Close download options",
    "download.arm.title": "Apple Silicon",
    "download.arm.body": "For Macs with an M-series chip",
    "download.intel.title": "Intel",
    "download.intel.body": "For Macs with an Intel processor",
    "download.unsigned": "Not Apple notarized. If blocked, check Privacy & Security → Open Anyway. If you cannot proceed, contact the developer.",
    "download.all": "View all releases ↗"
  }
};

const replySets = {
  zh: [
    { text: "周四同一时间可以。我会更新日程，并在会前把新版方案发给你。", tone: "清晰 · 周到", strategy: "同时确认两件事" },
    { text: "周四可以。我会调整邀请，并在见面前把更新后的方案发给你。", tone: "温和 · 简洁", strategy: "简短确认" },
    { text: "周四同一时间没问题。我会先发新版方案，再更新日历邀请。", tone: "平静 · 有条理", strategy: "说明行动顺序" }
  ],
  en: [
    { text: "Thursday at the same time works. I’ll update the invite and send the revised deck beforehand.", tone: "Clear · thoughtful", strategy: "Confirm both requests" },
    { text: "Thursday works. I’ll move the invite and get the updated deck to you before we meet.", tone: "Warm · concise", strategy: "Brief confirmation" },
    { text: "Thursday at the same time works for me. I’ll share the updated deck first, then update the invite.", tone: "Calm · structured", strategy: "State the sequence" }
  ]
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const replyElement = document.querySelector("[data-reply]");
const toneElement = document.querySelector("[data-reply-tone]");
const strategyElement = document.querySelector("[data-reply-strategy]");
const countElement = document.querySelector("[data-candidate-count]");
const platformNote = document.querySelector("[data-platform-note]");
const downloadDialog = document.querySelector("[data-download-dialog]");
const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
let activeLanguage = "zh";
let replyIndex = 0;
let downloadTrigger = null;

const translation = (key) => translations[activeLanguage][key] ?? key;

const renderReply = (index) => {
  const replies = replySets[activeLanguage];
  const reply = replies[index];
  if (!replyElement || !toneElement || !strategyElement || !countElement) return;
  replyElement.textContent = reply.text;
  toneElement.textContent = reply.tone;
  strategyElement.textContent = reply.strategy;
  countElement.textContent = `${index + 1} / ${replies.length}`;
};

const updatePlatformNote = () => {
  if (!platformNote) return;
  platformNote.textContent = translation(isMac ? "install.mac" : "install.other");
};

const setLanguage = (language, { persist = false, updateUrl = false } = {}) => {
  activeLanguage = language === "en" ? "en" : "zh";
  document.documentElement.lang = activeLanguage === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.language = activeLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translation(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    element.innerHTML = translation(element.dataset.i18nHtml);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", translation(element.dataset.i18nAria));
  });

  document.title = translation("meta.title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", translation("meta.description"));
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", translation("meta.title"));
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", translation("meta.ogDescription"));
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const selected = button.dataset.lang === activeLanguage;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  renderReply(replyIndex);
  updatePlatformNote();

  if (persist) localStorage.setItem("contextcue-language", activeLanguage);
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", activeLanguage);
    history.replaceState({}, "", url);
  }
};

const urlLanguage = new URLSearchParams(window.location.search).get("lang");
const savedLanguage = localStorage.getItem("contextcue-language");
const browserLanguage = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
setLanguage(urlLanguage || savedLanguage || browserLanguage);

document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang, { persist: true, updateUrl: true }));
});

const closeDownloadDialog = () => {
  if (!downloadDialog?.open) return;
  downloadDialog.close();
};

document.querySelectorAll("[data-download]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!downloadDialog?.showModal) return;
    event.preventDefault();
    downloadTrigger = event.currentTarget;
    downloadDialog.showModal();
    document.body.classList.add("has-open-dialog");
  });
});

document.querySelector("[data-download-close]")?.addEventListener("click", closeDownloadDialog);
document.querySelectorAll("[data-direct-download]").forEach((link) => {
  link.addEventListener("click", closeDownloadDialog);
});
downloadDialog?.addEventListener("click", (event) => {
  if (event.target === downloadDialog) closeDownloadDialog();
});
downloadDialog?.addEventListener("close", () => {
  document.body.classList.remove("has-open-dialog");
  downloadTrigger?.focus();
  downloadTrigger = null;
});

const revealItems = document.querySelectorAll(".reveal");
if (reduceMotion.matches || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -6%" });
  revealItems.forEach((item) => observer.observe(item));
}

const header = document.querySelector("[data-header]");
const setHeaderState = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

const scene = document.querySelector("[data-depth-scene]");
if (scene && !reduceMotion.matches && window.matchMedia("(pointer: fine)").matches) {
  scene.addEventListener("pointermove", (event) => {
    const bounds = scene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.querySelectorAll("[data-depth]").forEach((layer) => {
      const depth = Number(layer.dataset.depth || 1);
      layer.style.setProperty("--depth-x", `${x * depth * 14}px`);
      layer.style.setProperty("--depth-y", `${y * depth * 11}px`);
    });
  });
  scene.addEventListener("pointerleave", () => {
    scene.querySelectorAll("[data-depth]").forEach((layer) => {
      layer.style.setProperty("--depth-x", "0px");
      layer.style.setProperty("--depth-y", "0px");
    });
  });
}

const showReply = (index) => {
  if (!replyElement || !toneElement || !strategyElement) return;
  [replyElement, toneElement, strategyElement].forEach((element) => element.classList.add("is-switching"));
  window.setTimeout(() => {
    renderReply(index);
    [replyElement, toneElement, strategyElement].forEach((element) => element.classList.remove("is-switching"));
  }, 180);
};

if (!reduceMotion.matches) {
  window.setInterval(() => {
    replyIndex = (replyIndex + 1) % replySets[activeLanguage].length;
    showReply(replyIndex);
  }, 4200);
}
