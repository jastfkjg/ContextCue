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
- A detected external window / page-title mismatch clears the session and aborts its requests. With the revision composer open, preserve local candidates and instructions, show an expiry notice, and allow copying only. Otherwise hide the panel. Returning to the old window does not revive the snapshot. Moving focus to another field in the same page can hide and restore the panel only when the composer is closed.
- Closing the panel cancels its requests. Each suggestion or revision request has a 45-second total budget, including one existing format-repair retry. Ask AI also has a 45-second limit.
- The snapshot is fixed at invocation. Without DOM integration, content changes and same-title tabs cannot always be detected; reinvoke after navigating. The existing five-minute session lifetime remains.
- Disabling page context omits the screenshot and page metadata for that question, but not already completed turns in the same session. Start a fresh invocation for a fully empty conversation.

## Inline revision and candidate groups

- The home toolbar exposes Next, Copy / Insert, Revise and Ask AI. Revise opens an inline instruction composer below the current candidate. The former standalone Edit page, local edit map, Save draft action and `overlay:editing` IPC are removed.
- Dots remain real buttons with descriptive labels, pressed state and visible focus. Next, dots and horizontal swipes select candidates; arrows navigate outside text inputs. While composing, Enter does not insert a candidate. Enter in the field adds a line, Cmd / Ctrl + Enter submits, and Escape closes the composer before closing the overlay.
- Auto-fit preserves top-left position and width. Opening the composer releases a manually chosen height and grows downwards up to 540px, capped at the space available below the current position (8px display margin). The candidate and composer scroll within that area; the main toolbar remains outside the scrolling region. Success closes the composer and returns to candidate-fit height (normally capped at 360px). Drag resize remains available.
- Only the candidate selected at submission, explicit instructions and the invocation's saved screenshot are sent, with `contextPolicy: page-only`. Request the configured 1–5 candidate count in one model call, not one call per original candidate. The selected candidate's insertion action is preserved for every revised alternative.
- `assist:revise` takes `{sessionId, requestId, text, instruction}` and resolves to `CandidateReply[]`. `overlay:revision-candidate` emits `{sessionId, requestId, candidate}` for each validated complete candidate. Both Responses and Chat Completions SSE are supported; non-streaming JSON responses fall back to complete-group display. Initial generation keeps its existing non-streaming path.
- Parse only complete candidate objects or complete string entries from the candidates array, with JSON string/escape handling and deduplication. Never expose raw JSON, reasoning or an unfinished text field. Reuse the existing one-time format-repair retry for malformed candidate data, within the same 45-second budget; HTTP failures, refusals and stream errors are not retried automatically.
- Keep the current group visible until the first revised candidate is ready, then select that first result. Later arrivals append to the revised group without changing the selected index. Display the actual available count plus generation progress; a provider may return fewer usable alternatives than requested.
- Retain only the original group and the latest revised group. Back to original suggestions / Show revised suggestions switch between them. Revising again replaces the previous revised group, with rollback on failure. Returning from Ask AI preserves the group and selection; the hidden carousel suspends sizing and keyboard handling.
- Success collapses the composer without a save step. Stop keeps completed candidates and the instruction. Failure restores the pre-request group and selection, keeping the instruction for retry. No result arriving after stop, close, expiry or a new request may overwrite current state. `assist:cancel-revision` is scoped to its request ID, including while foreground validation is pending.
- `overlay:revision-composer` reports whether the current session's composer is open, preserving the panel through context invalidation. Copy / Insert is a separate explicit action and never submits a form or message. Page-only copying/insertion does not append accepted history or persistent preferences.

## Regression coverage and manual acceptance

Automated suites cover split SSE events and Unicode, completed-candidate parsing, JSON fallback, provider failures, request cancellation, candidate-group rollback and selection stability, fixed-position expansion near display edges, and mocked Electron IPC/session boundaries. Existing suites cover page-only memory exclusion, PNG image verification and expired-session rejection.

Browser preview checks (no live model, OS permissions or app insertion):

1. Enter a synthetic preview key, save, verify, generate the example, select a dot and finish into daily Home.
2. Reopen the setup guide; check that model settings are retained.
3. At the 420px overlay width, click each dot and test keyboard selection.
4. Open Revise, enter an instruction and append a preset. Confirm the candidate remains visible and the panel expands at the same position and width; near the display bottom, confirm internal scrolling and a reachable toolbar.
5. Deliver the first candidate while the request remains open, then a second; select the second and deliver a third. The selection must stay on the second. Finish and confirm the composer collapses without Save draft.
6. Switch to original suggestions and back. Open Ask AI and return; the revised group and selection must remain, with no extra question panel left in the DOM.
7. Stop before / after a result; fail a request after a partial group; expire the page; start a fresh session. Verify retained instructions, appropriate rollback, copy-only expired results and discarded late events.
8. Test a 340px-wide panel, long multiline candidates and instructions, manual resizing, and Escape from both the input and navigation buttons.

Packaged-app acceptance still required on each supported OS:

- Generate / ask in WeChat, then invoke in a browser while the first model request is still pending. Only browser content may appear; inspect outbound test-provider payloads for isolation.
- Repeat across two windows of the same app, browser tabs with different titles, and closing/reopening the same page.
- Confirm revised candidates insert only into the original validated control, never auto-send, and do not restore old results after closing.
- Verify permission denial/regrant and a real image-capable provider, without using sensitive conversations as test data.
