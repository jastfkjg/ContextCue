import "./styles.css";

const translations = {
  "zh": {
    "meta.title": "ContextCue — 就着当前屏幕，问清楚、写出来",
    "meta.description": "ContextCue 是当前屏幕上的 AI 助手。无需复制背景，按下快捷键，理解信息、起草回复或改写文字。",
    "meta.ogDescription": "不离开当前窗口，问清楚、写出来。",
    "skip": "跳到主要内容",
    "home.aria": "ContextCue 首页",
    "nav.aria": "主要导航",
    "nav.how": "如何工作",
    "nav.privacy": "隐私",
    "nav.install": "安装",
    "download.short": "下载测试版",
    "hero.title": "看懂屏幕。<br />写出想法。",
    "hero.lede": "不必复制背景，也不用切换工具。唤起 Ask AI，问一个问题，或说说你想怎么写。当前窗口就是上下文。",
    "hero.download": "下载 Mac 测试版",
    "hero.how": "看看它如何工作",
    "hero.release": "当前为未经 Apple 公证的内测版 · Apple Silicon / Intel",
    "demo.aria": "ContextCue 根据当前窗口回答问题的界面示意",
    "demo.online": "在线",
    "demo.today": "今天 15:42",
    "demo.incoming1": "周四同一时间可以吗？",
    "demo.outgoing": "没问题，我看一下日程。",
    "demo.incoming2": "另外，可以在开会前把更新后的方案发给我吗？",
    "demo.composer": "输入消息…",
    "demo.switch": "切换",
    "demo.insert": "插入",
    "demo.caption": "主动唤起才截图。页面变了，点击刷新即可开始新会话。",
    "signals.aria": "产品特点",
    "signals.invoke": "一次唤起",
    "signals.candidates": "理解与表达",
    "signals.insert": "插入但不发送",
    "signals.local": "自选模型",
    "workflow.title": "少一次切换，<br />多一点上下文。",
    "workflow.body": "看文档、读邮件、回消息。需要帮助时唤起，用完继续手上的事。",
    "workflow.one.title": "留在当前窗口",
    "workflow.one.body": "打开需要理解的页面或待回复的消息，让相关内容保持可见。",
    "workflow.two.title": "唤起 Ask AI",
    "workflow.two.body": "新安装默认按 ⌘ ⇧ Space。问一个问题，或说明写作目标；也可点选总结、解释、回复或改写。",
    "workflow.three.title": "读明白，或写出来",
    "workflow.three.body": "解释直接阅读；草稿可以继续修改，再复制或插入。熟练后可用单独的快捷键直接生成写作建议。",
    "context.title": "背景在屏幕上。<br />意图由你说清楚。",
    "context.body": "同一条消息，你可能想同意，也可能想婉拒。告诉 ContextCue 你的目标，再用“更简短”或自己的要求调整草稿。",
    "context.one": "先说明立场，再组织表达",
    "context.two": "候选可切换，修改可对照",
    "context.three": "检查后复制或插入，由你发送",
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
    "privacy.one.body": "主动唤起或点击刷新时，才截取一次当前可见窗口。不会持续录屏。",
    "privacy.two.title": "会话隔离",
    "privacy.two.body": "当前会话不读取长期记忆或历史采用回复。刷新截图会开启新会话。",
    "privacy.three.title": "自选模型",
    "privacy.three.body": "需要页面上下文时，截图会发送到你选择的模型接口。可关闭页面上下文，API Key 通过系统能力加密。",
    "privacy.four.title": "从不代发",
    "privacy.four.body": "草稿由你检查后复制或插入支持的输入框，最后的发送或提交由你完成。",
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
    "install.three.body": "配置支持图片输入的模型，按引导开启屏幕权限。辅助功能权限可选，用于跨应用插入。",
    "final.title": "不用搬运背景。<br />就在这里，开始。",
    "footer.tagline": "当前屏幕上的理解与表达助手。",
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
    "download.all": "查看所有版本 ↗",
    "demo.question": "开会之前，我需要做什么？",
    "demo.answer": "提前发送更新后的方案。对方还提出把会议改到周四同一时间，等待你确认。",
    "demo.placeholder": "问个问题，或说说想怎么写…"
  },
  "en": {
    "meta.title": "ContextCue — ask and write from your screen",
    "meta.description": "Your AI assistant for the current screen. Ask questions, draft replies, and rewrite text without copying the background.",
    "meta.ogDescription": "Understand and write without leaving your current window.",
    "skip": "Skip to main content",
    "home.aria": "ContextCue home",
    "nav.aria": "Main navigation",
    "nav.how": "How it works",
    "nav.privacy": "Privacy",
    "nav.install": "Install",
    "download.short": "Download beta",
    "hero.title": "Your screen.<br />Ask. Write.",
    "hero.lede": "Skip copying the background. Open Ask AI, ask a question, or describe what to write. Your current window supplies the context.",
    "hero.download": "Download for Mac",
    "hero.how": "See how it works",
    "hero.release": "Not Apple notarized · Apple Silicon / Intel",
    "demo.aria": "Illustration of ContextCue answering a question about the current window",
    "demo.online": "Online",
    "demo.today": "Today 15:42",
    "demo.incoming1": "Could we move the sync to Thursday?",
    "demo.outgoing": "Sure — let me check my calendar.",
    "demo.incoming2": "Also, can you send the updated deck before we meet?",
    "demo.composer": "Write a message…",
    "demo.switch": "choose",
    "demo.insert": "insert",
    "demo.caption": "Capture on invocation. Refresh when the page changes to start a new conversation.",
    "signals.aria": "Product highlights",
    "signals.invoke": "One shortcut",
    "signals.candidates": "Understand and write",
    "signals.insert": "Insert, never send",
    "signals.local": "Your choice of model",
    "workflow.title": "Less switching.<br />More context.",
    "workflow.body": "Read a document, review an email, or reply to a message. Get help where you are, then carry on.",
    "workflow.one.title": "Stay in your window",
    "workflow.one.body": "Keep the page or message you need help with visible on screen.",
    "workflow.two.title": "Open Ask AI",
    "workflow.two.body": "New installs use ⌘ ⇧ Space. Ask a question, describe a draft, or start with Summarize, Explain, Draft a reply, or Rewrite.",
    "workflow.three.title": "Read it, or use a draft",
    "workflow.three.body": "Read an explanation, or revise a draft before copying or inserting it. A separate shortcut takes you straight to writing suggestions.",
    "context.title": "Your screen gives context.<br />You give the intent.",
    "context.body": "The same message might call for agreement or a polite decline. Describe your goal, then refine a draft with “Shorter” or your own instructions.",
    "context.one": "Set the intent before choosing the words",
    "context.two": "Compare candidates and revisions",
    "context.three": "Review, copy or insert, then send yourself",
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
    "privacy.one.body": "Capture one visible window when you invoke or refresh. No continuous screen recording.",
    "privacy.two.title": "Separate sessions",
    "privacy.two.body": "Current sessions exclude saved memory and accepted replies. Refreshing the screenshot starts a new conversation.",
    "privacy.three.title": "Bring your model",
    "privacy.three.body": "Page context goes to the model endpoint you choose. You can turn page context off. API keys use operating-system encryption.",
    "privacy.four.title": "It never sends",
    "privacy.four.body": "Review each draft, then copy or insert it into a supported field. You send or submit it yourself.",
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
    "install.three.body": "Connect an image-capable model and allow screen access. Accessibility is optional, for inserting into other apps.",
    "final.title": "Leave the background<br />where it is.",
    "footer.tagline": "Understand and write from your current screen.",
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
    "download.all": "View all releases ↗",
    "demo.question": "What do I need to do before we meet?",
    "demo.answer": "Send the updated deck beforehand. They also proposed Thursday at the same time and are waiting for your confirmation.",
    "demo.placeholder": "Ask a question or describe a draft…"
  }
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const platformNote = document.querySelector("[data-platform-note]");
const downloadDialog = document.querySelector("[data-download-dialog]");
const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
let activeLanguage = "zh";
let downloadTrigger = null;

const translation = (key) => translations[activeLanguage][key] ?? key;

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
