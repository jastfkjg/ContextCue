import { examples } from "./fixtures.mjs";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") === "zh-CN" ? "zh-CN" : "en";
const scene = ["reply", "revise", "ask", "settings"].includes(params.get("scene")) ? params.get("scene") : "ask";
const example = examples[locale];
document.documentElement.lang = locale;

if (params.get("mode") === "app") {
  const { contextCueApi } = await import("../../src/lib/api.ts");
  const settings = await contextCueApi.getSettings();
  await contextCueApi.saveSettings({ ...settings, onboardingComplete: true });
  await import("../../src/main.tsx");
} else if (params.get("mode") === "overlay") {
  // Inject fixture responses into the existing browser preview API before React
  // mounts. The panels, typography, controls and interactions are production UI.
  const { contextCueApi } = await import("../../src/lib/api.ts");
  const candidates = (texts) => texts.map((text) => ({ text, tone: "", strategy: "" }));
  const context = {
    sessionId: "readme-demo", applicationName: example.chat, windowTitle: example.project,
    channel: "other", hasPageContext: true, canReturnToSuggestions: false,
    capturedAt: "2026-09-03T09:41:00Z"
  };
  const delayed = (callback, payload) => {
    const timer = setTimeout(() => callback(payload), 40);
    return () => clearTimeout(timer);
  };
  let askListener;
  let openListener;
  let revisionListener;
  let activeContext = context;
  const draft = () => ({
    ...activeContext, contact: example.person, candidates: candidates(example.candidates),
    scenario: "reply", detectedContact: example.person, detectedLanguage: locale,
    conversationSummary: example.messages.join(" "), memorySuggestions: [], generatedAt: "2026-09-03T09:42:00Z"
  });
  Object.assign(contextCueApi, {
    onOverlayResult: () => () => {},
    onAskOpen: (callback) => {
      openListener = callback;
      const cancel = delayed(callback, activeContext);
      return () => { cancel(); openListener = undefined; };
    },
    openAsk: async () => {
      window.frameElement.parentElement.style.top = "227px";
      window.frameElement.style.height = "416px";
      return { ...activeContext, canReturnToSuggestions: true };
    },
    refreshAsk: async () => {
      activeContext = { ...context, sessionId: "readme-refreshed" };
      openListener?.(activeContext);
      return activeContext;
    },
    showDraft: async () => {
      window.frameElement.parentElement.style.top = scene === "revise" ? "274px" : "388px";
    },
    onAskEvent: (callback) => { askListener = callback; return () => { askListener = undefined; }; },
    startAsk: (request) => setTimeout(() => askListener?.({
      ...request, type: "complete",
      answer: request.question === example.draftRequest ? example.draftAnswer : example.answer,
      ...(request.question === example.draftRequest ? { draft: draft() } : {})
    }), 60),
    onRevisionCandidate: (callback) => { revisionListener = callback; return () => { revisionListener = undefined; }; },
    reviseSuggestion: async (request) => {
      const revised = candidates(example.revisions);
      for (const candidate of revised) revisionListener?.({ ...request, candidate });
      return revised;
    },
    resizeOverlay: (height) => {
      // Allow a little reading room around the measured content in the preview
      // viewport, as a user can by resizing the native panel.
      if (scene !== "ask") window.frameElement.style.height = `${Math.max(168, Math.min(height + 18, 540))}px`;
    }
  });
  await import("../../src/main.tsx");
} else {
  await import("@fontsource-variable/inter");
  await import("./stage.css");
  const copy = example.scenes[scene];
  // All content below is maintained locally in fixtures.mjs (never user input).
  document.querySelector("#root").innerHTML = `
    <main class="stage stage--${scene}">
      <header class="masthead"><div class="brand"><img src="/build/icon.svg" alt="" />ContextCue</div><span> ${copy.eyebrow}</span></header>
      <h1>${copy.title}</h1><p class="subtitle">${copy.subtitle}</p>
      ${scene === "settings" ? `<section class="app-position"><iframe title="ContextCue" src="./preview.html?mode=app&scene=settings&locale=${locale}"></iframe></section>` : `
      <section class="chat-window" aria-label="${example.chat}">
        <header class="window-chrome"><div class="traffic"><i></i><i></i><i></i></div><span>${example.chat}</span></header>
        <div class="chat-layout"><aside><strong>${example.team}</strong><small>${locale === "en" ? "CHANNELS" : "会话列表"}</small>${example.sidebar.map((item, index) => `<div class="channel ${index === 0 ? "selected" : ""}"><span>#</span>${item}</div>`).join("")}</aside>
        <div class="chat-main"><header><strong># ${example.project}</strong><span>${locale === "en" ? "3 members" : "3 位成员"}</span></header>
          <div class="messages"><div class="date">${example.today}</div>${example.messages.map((message, index) => `<article class="message"><div class="avatar ${index === 1 ? "avatar--me" : ""}">${index === 1 ? (locale === "en" ? "Y" : "你") : (locale === "en" ? "J" : "悦")}</div><div><strong>${index === 1 ? example.me : example.person}</strong><p>${message}</p></div></article>`).join("")}</div>
          <div class="message-input">${example.placeholder}<span>↵</span></div>
        </div></div>
      </section>
      <section class="panel-position"><div class="panel-label"><i></i>${scene === "ask" ? example.askLabel : example.label}</div><iframe title="ContextCue" src="./preview.html?mode=overlay&scene=${scene}&locale=${locale}"></iframe></section>`}
      <div class="tip"><kbd>${copy.shortcut}</kbd><span>${copy.tip}</span></div>
      <footer><span>${scene === "settings" ? "ContextCue" : example.footer}</span><span>contextcue</span></footer>
    </main>`;
}
