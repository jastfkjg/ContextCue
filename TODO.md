# ContextCue roadmap

This roadmap only lists unfinished, outcome-oriented work. Keep P0 small; move a new item into P0 only after another one ships.

## P0 — make the core loop trustworthy

- [ ] **Bound every request:** add cancellation, generation timeouts, safe retry/backoff, and actionable permission, network, and rate-limit errors; release screenshot data in `finally` paths.
- [ ] **Validate trust boundaries:** runtime-validate IPC payloads and model output, redact logs by default, and add regression cases for screenshot prompt injection and malformed providers.
- [ ] **Give users control of local data:** encrypt the memory store with a recoverable migration, then add export/import, retention controls, and “delete all local data”.
- [ ] **Capture only what is needed:** support region selection, multi-display coordinates, and adaptive crop/resolution so small text stays readable without uploading unrelated pixels.
- [ ] **Insert into the right field:** preserve the originating app and focused control, use a macOS accessibility adapter, restore the clipboard when requested, and provide live permission re-checks.
- [ ] **Prove the packaged flow:** add Electron smoke tests plus a manual compatibility matrix for WeChat, Slack, Lark/Feishu, Gmail, Teams, and WhatsApp.

## P1 — improve quality, speed, and learning

- [ ] **Add a correction loop:** let users revise a candidate with “From now on…”, regenerate immediately, and save the rule at global, channel, person, or conversation scope.
- [ ] **Make memory explainable:** add provenance, confidence, freshness/expiry, conflict handling, per-contact learning controls, and a “do not remember this conversation” mode.
- [ ] **Upgrade retrieval:** combine scoped rules with local keyword/embedding reranking; show which memories influenced a reply and let users exclude them before retrying.
- [ ] **Learn only from evidence:** calibrate style from user-selected sent messages and accepted replies, never from received text or unchosen model drafts.
- [ ] **Build a reply-quality eval set:** measure context grounding, voice similarity, strategy diversity, unsafe invention, insertion success, latency, and token cost across channels and UI variants.
- [ ] **Reduce data and latency:** add optional on-device OCR/redaction, live provider capability probes, adaptive model routing, prompt-prefix caching, and time-to-first-usable-reply metrics.

## P2 — differentiated workflows

- [ ] **Turn conversations into state:** track “needs reply”, “waiting on them”, “follow up later”, and “resolved” in a local relationship view.
- [ ] **Offer confirm-before-action cards:** detect scheduling intent and draft editable calendar/follow-up actions; never execute an external action without confirmation.
- [ ] **Add privacy-preserving voice:** support push-to-talk with local speech recognition and separate verbatim from intent mode.
- [ ] **Expand context deliberately:** add opt-in OAuth history for priority channels and optional local vision/language models, each with explicit scopes and retention.
- [ ] **Finish distribution:** signed/notarized builds, staged updates with rollback, release CI, launch-at-login, localization, keyboard/screen-reader audits, and Windows/Linux insertion support.

## Roadmap guardrails

- Never auto-send a message or silently create an external event.
- Never learn from received messages, rejected drafts, or background capture.
- Prefer a smaller, inspectable context over collecting more history.
- Every feature that sends or stores conversation data must expose its scope, destination, and deletion path.
