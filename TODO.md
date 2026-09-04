# ContextCue roadmap

Product focus: an assistant for understanding and writing from the current screen. Ask AI is the main entry; replies and rewrites are the priority writing scenarios. Quick writing remains a direct path.

This roadmap only lists unfinished, outcome-oriented work. Keep P0 small; move a new item into P0 only after another one ships.

## P0 — make the core loop trustworthy

- [ ] **Finish request recovery:** add safe network retry/backoff and actionable permission and rate-limit recovery. Page requests now have cancellation/timeout and stale-result guards; audit remaining legacy paths and screenshot cleanup.
- [ ] **Validate trust boundaries:** runtime-validate IPC payloads and model output, redact logs by default, and add regression cases for screenshot prompt injection and malformed providers.
- [ ] **Give users control of local data:** encrypt the memory store with a recoverable migration, then add export/import, retention controls, and “delete all local data”.
- [ ] **Capture only what is needed:** support region selection, multi-display coordinates, and adaptive crop/resolution so small text stays readable without uploading unrelated pixels.
- [ ] **Insert into the right field:** preserve the originating app and focused control, use a macOS accessibility adapter, restore the clipboard when requested, and provide live permission re-checks.
- [ ] **Prove the packaged flow:** add Electron smoke tests plus a manual compatibility matrix for WeChat, Slack, Lark/Feishu, Gmail, Teams, and WhatsApp.

## P1 — prove the ask-and-write loop

- [ ] **Validate the main entry with users:** compare successful tasks and time to useful output for Ask AI and Quick writing; measure reading value separately from draft adoption. Keep any instrumentation explicit and exclude conversation content.
- [ ] **Build an ask-and-write eval set:** measure understanding, clarification vs. drafting, context grounding, voice similarity, strategy diversity, unsafe invention, insertion success, latency, and token cost across channels and UI variants.
- [ ] **Reduce data and latency:** add optional on-device OCR/redaction, broader capability probes beyond the setup image test, adaptive model routing, prompt-prefix caching, and time-to-first-usable-reply metrics.

## P2 — differentiated workflows

- [ ] **Add privacy-preserving voice:** support push-to-talk with local speech recognition and separate verbatim from intent mode.
- [ ] **Expand context deliberately:** add opt-in OAuth history for priority channels and optional local vision/language models, each with explicit scopes and retention.
- [ ] **Finish distribution:** signed/notarized builds, staged updates with rollback, release CI, launch-at-login, localization, keyboard/screen-reader audits, and Windows/Linux insertion support.

## Deferred — opt-in memory and relationship workflows

Revisit after the current-screen ask-and-write loop demonstrates repeat use. Existing local data remains available; no implicit retrieval is planned.

- [ ] **Make corrections reusable only by explicit choice:** in-place editing and one-sentence revision are available. If persistent rules are added later, expose explicit scope and consent; never silently bring old-window context into page-only sessions.
- [ ] **Make memory explainable:** add provenance, confidence, freshness/expiry, conflict handling, per-contact learning controls, and a “do not remember this conversation” mode.
- [ ] **Revisit opt-in retrieval:** page-only sessions exclude stored memory. Any future retrieval must be user-invoked, preview its exact scope, and preserve the default window-isolation boundary.
- [ ] **Learn only from evidence:** calibrate style from user-selected sent messages and accepted replies, never from received text or unchosen model drafts.

- [ ] **Turn conversations into state:** track “needs reply”, “waiting on them”, “follow up later”, and “resolved” in a local relationship view.
- [ ] **Offer confirm-before-action cards:** detect scheduling intent and draft editable calendar/follow-up actions; never execute an external action without confirmation.

## Roadmap guardrails

- Never auto-send a message or silently create an external event.
- Never learn from received messages, rejected drafts, or background capture.
- Prefer a smaller, inspectable context over collecting more history.
- Each invocation starts a fresh page-only session; old windows, saved memory and accepted drafts must not be carried into it implicitly.
- Every feature that sends or stores conversation data must expose its scope, destination, and deletion path.
