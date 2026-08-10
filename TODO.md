# ContextCue roadmap

This file tracks work that is intentionally not presented as complete in the current MVP.

## P0 — production correctness and privacy

- [ ] Add selectable screenshot regions and multi-monitor-aware cropping; preserve enough resolution for small chat text without sending unrelated screen areas.
- [ ] Add a local OCR preview and redaction pass so users can remove secrets, account numbers, or unrelated names before upload.
- [ ] Encrypt the full memory database at rest, add a key rotation path, and keep a recoverable migration from the current JSON format.
- [ ] Add memory export, import, per-item retention, and a “delete all local data” flow.
- [ ] Add request cancellation, retry with backoff, provider timeouts, and clearer handling for permission errors and rate limits.
- [ ] Add strict runtime validation for every IPC payload and model response (for example with Zod).
- [ ] Ensure the screenshot data URL is released immediately after generation and never included in crash reports or analytics.
- [ ] Add opt-in diagnostics with aggressive redaction; keep diagnostics disabled by default.
- [ ] Add end-to-end tests for capture → model → carousel → copy/insert on macOS and Windows.
- [ ] Resolve dependency audit findings by upgrading/replacing transitive Electron Builder dependencies without using forced breaking upgrades.

## P0 — cross-application reliability

- [ ] Replace best-effort AppleScript/SendKeys insertion with native accessibility adapters that restore focus and insert at the exact active text field.
- [ ] Add app-specific adapters for WeChat, Slack, Lark/Feishu, Gmail, Microsoft Teams, and WhatsApp.
- [ ] Add a safe clipboard restore option after insertion.
- [ ] Detect the frontmost application before ContextCue opens and target that exact process when inserting.
- [ ] Improve channel/contact detection from window titles and visible UI; expose corrections that can be remembered.
- [ ] Handle self-drawn WeChat UI, browser zoom, dark mode, compact sidebars, and group conversations in screenshot prompts/evals.
- [ ] Add macOS screen-recording and accessibility permission onboarding with live re-checks after returning from System Settings.

## P1 — interaction parity with OKEight

- [ ] Implement native double-tap Option to capture/draft without conflicting with normal modifier use.
- [ ] Implement hold Option for push-to-talk dictation and a single-tap toggle between verbatim and intent modes.
- [ ] Add local speech recognition (Apple Speech/Whisper.cpp) with punctuation and filler cleanup.
- [ ] Position the floating candidate window next to the active text field using accessibility bounds.
- [ ] Support `Esc` to close without side effects and reliable `Enter` insertion while the original app remains focused.
- [ ] Add a one-line “From now on…” correction field that rewrites the current candidate and saves a scoped preference.
- [ ] Add a lightweight translation gloss for foreign-language replies without changing the reply text.
- [ ] Add an on-device, opt-in mood label that never stores or uploads camera frames.

## P1 — richer channels and actions

- [ ] Add OAuth history sync for Slack, Lark/Feishu, and Gmail with least-privilege scopes and explicit retention controls.
- [ ] Learn style only from messages confirmed to be sent by the user; never learn from received messages.
- [ ] Add deterministic thread/contact identity across desktop and browser versions of each channel.
- [ ] Integrate EventKit, Google Calendar, and Lark Calendar availability.
- [ ] Detect proposed meetings and show an editable event card before creating anything.
- [ ] Extract follow-ups into explicit states: needs your reply, waiting on them, follow up later, and resolved.
- [ ] Add a local relationship-card view with tone history and open follow-ups per person.

## P1 — memory quality

- [ ] Replace basic keyword/contact filtering with local embeddings or a compact local reranker.
- [ ] Add memory conflict detection, freshness/expiry, provenance, and confidence.
- [ ] Separate global writing rules, channel rules, relationship rules, and one-conversation instructions with clear precedence.
- [ ] Let users edit or reject inferred contact names before generation.
- [ ] Build a style calibration flow from several user-selected sent messages and produce an inspectable style report.
- [ ] Add evaluations that measure voice similarity, factual grounding, strategy diversity, and invented personal details.
- [ ] Add a “do not remember this conversation” mode and per-contact learning toggle.

## P2 — model and performance

- [ ] Downscale/crop screenshots adaptively based on text size and model image-token limits.
- [ ] Add a provider capability check for vision, structured output, context length, and model availability.
- [ ] Add optional local vision/OCR and local language models for privacy-sensitive use.
- [ ] Cache stable prompt prefixes without caching raw screenshots or transient conversation content.
- [ ] Stream candidate status where supported and measure time-to-first-usable-reply.
- [ ] Add per-request cost estimates and a local usage dashboard.
- [ ] Add prompt/version telemetry only as anonymous counters, never raw content.

## P2 — distribution and platform polish

- [ ] Add application icons, signed installers, macOS hardened runtime/notarization, and Windows code signing.
- [ ] Add automatic updates with staged rollout and rollback.
- [ ] Add a tray/menu-bar mode and launch-at-login controls.
- [ ] Add a Windows-native accessibility insertion implementation and Linux Wayland support.
- [ ] Localize the full UI in English and Simplified Chinese.
- [ ] Add keyboard navigation and screen-reader audits for all dialogs and carousel controls.
- [ ] Add a first-run privacy tour explaining exactly what is captured, stored, and sent.

## P2 — engineering quality

- [ ] Add React component tests for swipe gestures, keyboard switching, and memory confirmation.
- [ ] Add Playwright/Electron smoke tests on packaged builds.
- [ ] Add release CI for macOS arm64/x64, Windows x64, and Linux.
- [ ] Add crash recovery for interrupted atomic memory writes and retain one encrypted backup.
- [ ] Add a formal threat model covering screenshot prompt injection, malicious providers, IPC abuse, clipboard exposure, and local memory theft.
- [ ] Benchmark large memory stores and introduce pagination/compaction before the 250-fact limit becomes user-visible.
