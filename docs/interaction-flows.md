# Page-only interaction flows

## First run

1. New installs show the three-step Setup guide. Existing installs with saved credentials or usage migrate as completed unless they already have an explicit completion flag.
2. Select a provider, model ID and key. Connection details expose the base URL and protocol. Saving preserves other configured models; choosing a new provider adds a model. For a local server without authentication, a placeholder key is used when the field is blank.
3. Verify model sends a randomized six-color synthetic PNG. The expected order is not sent in the text prompt. An endpoint returning OK without reading the image fails this check. This is a narrow probe, not a guarantee of model quality.
4. Screen access is checked locally. Recheck after changing OS permissions. Accessibility is optional: unrecognized fields and platforms without insertion support still use copying.
5. The example sends only the visible fictional conversation image and its explicit sample intent. It neither captures real pages nor inserts text. Provider charges may apply to both verification and generation.
6. Completion is persisted in `settings.onboardingComplete`; Home then shows daily shortcuts and readiness. Setup guide remains available from the sidebar. Deferring does not mark it complete.

## Session boundary

- A session ID belongs to one invocation, not a channel or application. Reopening in the same window also starts fresh.
- Snapshot, input target, candidates, Q&A history and in-flight requests are owned by that session.
- Suggestion / revision requests use `contextPolicy: page-only`. Stored documents, profiles, facts, contacts and accepted examples are excluded. Existing local data is not deleted.
- Ask AI history is owned by the main process, never accepted from the renderer; only the latest three completed turns in that session are included.
- The React question panel is keyed by session ID. Reset notifications clear candidates and question state. Late async opens, model results and stream deltas are guarded against replaced sessions.
- A detected external window / page-title mismatch clears the session and aborts its requests. Returning to the old window does not revive it. Merely moving focus to another field in the same page can hide and restore the panel.
- Closing the panel cancels its requests. Suggestions and revisions share a 45-second total request budget, including one existing format-repair retry. Ask AI also has a 45-second limit.
- The snapshot is fixed at invocation. Without DOM integration, content changes and same-title tabs cannot always be detected; reinvoke after navigating. The existing five-minute session lifetime remains.
- Disabling page context omits the screenshot and page metadata for that question, but not already completed turns in the same session. Start a fresh invocation for a fully empty conversation.

## Candidate editing

- Dots are real buttons with descriptive labels, pressed state, visible focus and enlarged hit areas. Click any dot, or Tab then Enter / Space; arrow keys and Next still work outside editing.
- Edit opens a local draft. Typing and saving do not call the model. Escape cancels; Cmd / Ctrl + Enter saves. Arrow keys inside fields move the caret instead of changing candidates.
- Editing can expand the panel up to 540px high (bounded by the display); Cancel / Save draft stay outside the scrolling editor. Saving returns to content-fit height.
- One-sentence revision sends the draft as data, the user's instruction and the original page snapshot. Only one revised candidate is requested. The original insertion action is preserved.
- The returned text remains editable. Save draft updates only the current candidate; Copy / Insert is a separate explicit action and never submits a form or message.
- Stop cancels the revision. Errors keep the draft and instruction for retry. Closing/replacing a session invalidates late revisions.
- Page-only copying/insertion does not append long-term accepted history. No modification automatically becomes a persistent preference.

## Regression coverage and manual acceptance

Automated suites cover page-session history and memory exclusion, model revision payloads and cancellation, actual PNG probe output and failed image verification, plus mocked Electron IPC/shortcut transitions from WeChat to Browser, late-result suppression and rejection of expired revisions.

Browser preview checks (no live model, OS permissions or app insertion):

1. Enter a synthetic preview key, save, verify, generate the example, select a dot and finish into daily Home.
2. Reopen the setup guide; check that model settings are retained.
3. At the 420px overlay width, click each dot and test keyboard selection.
4. Edit a candidate; move the caret with arrows, save, change candidates and return. The saved draft should remain.
5. Request a one-sentence revision, review, save and cancel another edit. Check that Escape cancels editing before closing the panel.

Packaged-app acceptance still required on each supported OS:

- Generate / ask in WeChat, then invoke in a browser while the first model request is still pending. Only browser content may appear; inspect outbound test-provider payloads for isolation.
- Repeat across two windows of the same app, browser tabs with different titles, and closing/reopening the same page.
- Confirm a local edit and an AI revision insert only into the original validated control, never auto-send, and do not restore old results after closing.
- Verify permission denial/regrant and a real image-capable provider, without using sensitive conversations as test data.
