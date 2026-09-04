# ContextCue user guide

[Back to README](../README.md) · [简体中文](./guide.zh-CN.md)

Invoke ContextCue from the current app or browser window to open Ask AI: ask for understanding or describe what to write. A separate Quick writing shortcut generates suggestions directly. Every invocation starts a fresh page-only session using its screenshot, explicit input and in-session content—not previous windows, saved memory or accepted replies. Ask AI can also exclude page context. An editable field is not required: on macOS a recognized field supports direct insertion; otherwise suggestions can be copied. You review the text and decide what to use—ContextCue never submits or sends it automatically.

Local-first means memory and settings are stored on your device, not that model inference necessarily runs locally. Screenshots and relevant context are sent to your configured model provider when used in a request.

> [!IMPORTANT]
> Screenshot-based suggestions and Ask AI with page context require a model that supports **image input**. Ask AI without page context also works with text-only models. Some compatible providers silently ignore unsupported image input; ContextCue flags known text-only models and blocks screenshot-based requests for models marked as text-only.

## At a glance

| | Capability | What it does |
|---|---|---|
| ⚡ | **Any-window invocation** | Press one global shortcut from an app or browser page, with or without an input field. |
| ✦ | **Streaming Ask AI** | Use the main entry for streamed answers or usable drafts, with optional page context. |
| ✦ | **Task-aware drafts** | Generate replies, form-field text, new drafts, rewrites, search queries, and text completions. |
| ↔️ | **Lightweight candidate panel** | Switch with a two-finger swipe, horizontal gesture, dots, or arrow keys. |
| ↵ | **Apply without submitting** | On macOS, validate the original control before inserting or replacing text. |
| ✦ | **Revise into multiple alternatives** | Describe a change below the current suggestion. Revised candidates appear in place, with the original group one click away. |
| 🧠 | **Preserved local memory** | Existing Markdown notes, facts and history remain manageable on-device, but are excluded from page-only sessions. |
| ✓ | **First-run guide** | Connect a provider, verify image input and permissions, then practice with a fictional conversation. |
| ◉ | **Multiple model providers** | Configure several Responses or Chat Completions endpoints and choose the default model. |
| ◷ | **Local usage tracking** | Review provider-reported token counts, model breakdowns, and request history by date range. |
| 🔒 | **OS-protected keys** | Encrypt each API key with Electron `safeStorage` and the operating-system keychain. |

Window selection uses the operating system's foreground window ID, without an application-name allowlist. Channel labels such as WeChat, Slack, and Gmail provide optional model context and never determine which window is captured.

Search assistance drafts search queries; it does not execute a web search.

## How it works

The main entry follows this flow:

```text
Current app or browser window
  └─ Ask AI shortcut → capture the visible window, create an isolated session
      └─ user question or writing intent → one model request
          ├─ understanding → streamed answer → follow-up question
          └─ writing → validated drafts → revise → copy or insert
```

The Quick writing shortcut still generates 1–5 suggestions directly, without first typing a question.

The floating panel follows the originating native window. Switching to another application or window temporarily hides it; returning restores the session. Moving between text fields on the same page does not hide the panel. A detected page-title change in the original window, or the five-minute session limit, expires the captured context and cancels requests while preserving suggestions, instructions and visible Q&A for reading and copying. Return to Ask AI and refresh, or reopen ContextCue, to use AI or insert after expiry. Every new invocation captures a fresh page and starts a new session, even in the same window. Insertion validates the original target again before writing.

Drag the Ask AI header or the suggestion panel’s top bar to move the window. Movement uses native window dragging across displays; buttons and resize handles stay interactive.

Suggestions initially fit their content. Drag any edge or the bottom-right corner to resize. A subtle curved hint appears when that corner is hovered or keyboard-focused. Your reading width persists for the current app run; switching candidates or reopening the panel fits the height to the new content. A manually adjusted height lasts for the current candidate. Ask AI keeps its own size. Focus the resize grip and use arrow keys for precise adjustment, or Shift + arrows for larger steps.

New installs use `⌘ ⇧ Space` / `Ctrl ⇧ Space` for Ask AI and `⌘ ⇧ Enter` / `Ctrl ⇧ Enter` for Quick writing. Upgrades preserve existing shortcuts. It saves the page snapshot before opening the panel, so submitting a question never recaptures a different tab. You can turn off page context before sending a question; if capture is unavailable, the panel explains why and allows questions without it. Ask AI uses your question, recent in-panel Q&A, and the optional snapshot—not your long-term memory documents. Closing the panel clears the screenshot and in-memory Q&A. The header shows the captured page source; toggling it off displays **Page off**. **Summarize**, **Explain**, **Draft a reply**, and **Rewrite** fill the question field for review before sending. Enter sends and Shift + Enter adds a line.

The refresh button beside the page source captures the original window again and starts a new session, clearing old answers, candidates, and unsent input. Hover the source for the capture time. Failed refreshes preserve existing content; a refresh cannot capture another native window. Invoke with the shortcut in another window to use it instead.

Candidate dots share a compact header with the count and are keyboard accessible with Tab then Enter / Space. Choose **Revise** in the home toolbar to open **How should this change?** below the visible candidate. The panel keeps its position and width, expands downwards up to 540px, and keeps the current candidate visible above the instructions when the screen leaves less room. Long candidate text and the composer scroll independently; focusing the instruction field does not scroll the candidate away. **Collapse** closes only the composer and keeps your instructions; the top-right **X** closes the whole panel. **Shorter**, **Warmer** and **More direct** append to your instructions without replacing background you have entered. Enter adds a line; arrows inside the field move the caret; `Cmd / Ctrl + Enter` starts revision. Escape closes the composer first.

Explicit writing requests open the candidate panel once the complete result is validated. When intent is unclear, the model should ask a brief question. The model chooses the output type in the same request, without a separate classification call. Returning to Ask AI preserves the visible conversation; **Open draft** reopens the latest draft.

Revision uses the selected candidate, your instruction and the original snapshot. Drafts generated with page context off keep it off for subsequent revisions, omit page metadata, and work with text-only models. It requests the configured candidate count (1–5, normally 3) in one streaming request. Each complete, validated candidate appears as soon as it is ready; subsequent arrivals do not change your selection. **Revised · 1/3** identifies the new group. A provider that returns ordinary JSON instead of a stream shows its validated group once the response completes. Initial suggestion generation still waits for its complete response.

Success closes the composer automatically; there is no separate Edit page or Save draft step. **Back to original suggestions** and **Show revised suggestions** switch between the original group and the latest revision, without accumulating every past variant. **Stop** keeps completed candidates and your instructions. Failure restores the group shown before that request and keeps the instructions for retry. Copy / Insert remains a separate explicit action; neither generation nor revision sends a message. Returning from Ask AI preserves the candidate group and selection.

The main process owns each session's Q&A history and includes at most three completed turns. Suggestion and revision requests each have a 45-second total timeout, including a possible format-repair retry. Closing or replacing a session cancels requests and discards late results.

## Quick start

### Requirements

- Node.js 22.12+
- npm 10+
- macOS, Windows, or Linux
- An API key for a configured model; image input is required for screenshot-based features, but not for Ask AI with page context turned off

### Run locally

```bash
git clone https://github.com/jastfkjg/ContextCue.git
cd ContextCue
npm install
npm run dev
```

### First question or draft

1. First launch opens **Setup guide**. Choose a provider, enter an image-capable model ID and API key, and expand **Connection details** if needed. Advanced model management remains in **Settings**.
2. Choose **Verify model** to check connection and image understanding using a synthetic color image, not your windows. Check screen access, grant permissions in system settings if needed, then **Check again**. macOS insertion permission is optional; copying works without it.
3. Ask about the fictional example, or choose Draft a reply to prefill an explicit writing intent. Read the answer or choose a draft, then **Start using ContextCue** to enter the daily home. Verification and example requests may incur provider charges. Setup can be deferred or reopened from the sidebar. Completion persists; existing configured installs are not forced through setup again.
4. Open an app or page. Optionally focus a text field for direct insertion.
5. Press `⌘ ⇧ Space` on macOS or `Ctrl ⇧ Space` on Windows / Linux.
6. Type a question or describe what to write, then submit. Read an explanation or revise, copy, or insert a draft. ContextCue never submits automatically.

For immediate writing suggestions, press `⌘ ⇧ Enter` / `Ctrl ⇧ Enter`. On upgraded installs, use the shortcuts shown in Settings. **Ask AI** in the candidate panel returns to the same conversation. Both shortcuts can be changed in Settings. If either registration fails, ContextCue keeps both previous shortcuts.

### Environment variables

You can provide the default model connection through the environment instead of entering it in the interface:

```bash
cp .env.example .env
export CONTEXTCUE_API_KEY="your-key"
export CONTEXTCUE_API_BASE_URL="https://api.openai.com/v1"
export CONTEXTCUE_MODEL="your-vision-model"
npm run dev
```

Do not commit `.env` files.

## Settings workspace

Open **Settings** from the sidebar. **General** contains shortcut recording, writing language, suggestion count (2–5), and automatic suggestion display. Writing language affects generated content, not interface labels. **Models** manages connections and the default model; **Permissions** groups screen access, optional insertion access and capture troubleshooting; **About** contains application updates.

Valid changes save automatically after you finish typing. Check the **Saved** indicator before leaving; incomplete model fields and save failures are shown in the header. Home shortcuts lead to General, model management to Models, and screen checks to Permissions.

## Model providers

Each saved model has its own endpoint, protocol, image-input capability, and securely stored API key.

| API format | Use it when |
|---|---|
| **Responses API** | The provider explicitly supports an OpenAI-style `/responses` endpoint. |
| **Chat Completions** | The provider exposes a compatible `/chat/completions` endpoint, including many hosted and local services. |

**Test connection** in Settings verifies endpoint access and credentials. **Verify model** in the setup guide additionally checks the answer to a randomized synthetic color image; a text-only OK is not treated as image verification. This probe does not guarantee accurate understanding of every screenshot. Known DeepSeek text models are marked text-only during settings migration; unknown providers can be corrected in Settings.

## Local memory

Use **Memory** to keep and preview existing Markdown notes. Select a file from the left rail, switch between **Write** and **Preview**, and check the local save status below the editor. **File options** holds scope, enabled metadata, and deletion. **File options** contains All contexts / Channel / Person scopes, enabled state, and deletion. Scope and enabled state remain as compatibility metadata, but are not used by page-only sessions. Previously saved facts can still be inspected and removed.

The document names end in `.md`, but their contents are stored inside Electron's platform-specific `userData/contextcue-data.json`, alongside the other local data:

| Data | Purpose |
|---|---|
| `documents` | Editable Markdown context, scope, and enabled state |
| `profile` | Legacy personal context retained for compatibility and fallback |
| `contacts` | Relationship-specific tone, notes, and channel |
| `facts` | Explicitly saved preferences, durable facts, and follow-ups |
| `acceptedReplies` | Backward-compatible storage for up to 100 accepted suggestions, including task and target metadata |
| `tokenUsage` | Up to 5,000 local request records, including provider-reported token counts and model metadata |
| `settings` | Model, candidate, language, shortcut, and overlay preferences |

Page-only suggestions, revisions and Ask AI never load these documents, contacts, facts or accepted examples. Copying, inserting or revising in the floating panel no longer appends long-term accepted history. Existing data is preserved; provide any additional background explicitly in the current session. Legacy APIs and storage structures remain for compatibility.

## Screen & permissions

Open **Settings → Permissions**, also linked from Home. Screen recording status comes from the OS; “Test to verify” means the platform cannot report a definitive permission status. Accessibility is optional and used for insertion on macOS.

Expand **Test window capture** and choose **Start test**, then switch to the target window during the three-second countdown. Keep it in front until capture finishes, then return to Settings for the named, timestamped preview. If ContextCue is still focused, the target is unavailable, or its tab changes during capture, the test reports an error rather than showing a different source. You can cancel before capture starts. Previews clear when you leave the Permissions tab.

**Window diagnostics** is collapsed by default. Explicitly scan to see available windows and displays, with the scan time and separate permission, capture-failure, and empty-result messages. These local checks do not call the model, select Ask AI’s context, or alter an existing page session. Opening Home or Settings does not scan window thumbnails automatically.

## Token usage

Open **Token usage** to filter usage by model and the last 7 days, last 30 days, or all retained records. The page shows input/output totals, daily trends, model breakdowns, and recent request history. Counts come from provider responses; missing counts are shown as **Not reported**, not estimated. Usage records stay on your device and are not a provider billing statement.

## Privacy boundaries

- Page snapshots are captured on explicit invocation or refresh. Window lists and permission checks also read local thumbnails without uploading them. Setup verification and examples upload only synthetic images.
- Screenshots are sent to the configured model provider when used for suggestions or page-aware Q&A, but are not written to the long-term memory file. Turning off Ask AI page context excludes the snapshot and page metadata from the question request; it does not undo the snapshot already captured when opening the panel.
- Text inside screenshots and page metadata is treated as untrusted data, not as instructions.
- Long-term memory remains local and is excluded from page-only suggestion, revision and question requests.
- Saved API keys are not exposed back to the renderer process.
- Quick invocation is blocked when the macOS accessibility adapter recognizes a sensitive focused field, such as a password or verification-code input. This is not a guarantee that all sensitive content is detected: screenshots are not automatically redacted, and unrecognized controls or other platforms do not have the same field-level check.
- Applying begins by copying the suggestion; if exact write-back fails, nothing is pasted into a changed field.
- ContextCue does not record the screen in the background and does not submit forms or send messages automatically.

> [!NOTE]
> These are ContextCue's application boundaries, not a guarantee about a third-party provider. Review that provider's retention policy before processing sensitive conversations.

## Architecture

```text
Electron main process
  ├─ desktopCapturer / screencapture   visible-window capture
  ├─ globalShortcut                    system-wide invocation
  ├─ safeStorage                       per-model API-key encryption
  ├─ accessibility target adapter      focused-control metadata and validation
  ├─ clipboard + OS automation         exact write-back with safe fallback
  ├─ MemoryStore                       local JSON memory and migration
  └─ Model adapter                     Responses + Chat Completions

Typed preload bridge
  └─ narrow IPC surface

React renderer
  ├─ writing and capture workspace
  ├─ clickable / swipeable candidates with in-place revision
  ├─ Markdown memory documents and saved facts
  ├─ token usage and request history
  ├─ channel discovery
  ├─ multi-model settings
  └─ context-bound suggestions and streaming Ask AI panel
```

The browser build uses a non-networked preview dataset for UI review. Real screenshots, global shortcuts, secure key storage, and cross-application insertion require Electron.

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Start Electron in development mode |
| `npm run lint` | Run TypeScript validation |
| `npm test` | Run unit tests |
| `npm run test:window` | macOS: verify two same-title native windows and capture locally without model calls |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Build main, preload, and renderer bundles |
| `npm run package` | Create an unpacked desktop application |
| `npm run dist` | Create platform installers |
| `npm run dist:mac:beta -- --arm64` | Build an ad-hoc signed macOS beta; use `--x64` for Intel |

ContextCue checks for updates 15 seconds after launch and every 6 hours while running. New releases appear in a system notification and the sidebar. You can also use **Settings → About → App updates** or **Check for Updates…** in the tray context menu.

Downloads start when you choose them and display progress. Developer ID signed and notarized macOS builds offer **Restart and update**. The default ad-hoc signed, unnotarized macOS beta builds download and verify a DMG inside the app; choose **Open installer**, quit ContextCue, and replace the app in Applications. Memory and settings live outside the app bundle.

The release workflow supports optional signing/notarization and generates a combined update feed for Intel and Apple Silicon. See the [update release guide](./updates.md) for setup and verification. Users of older builds without an updater must install an updater-enabled build manually once.

## Current limitations

- Screenshots are resized rather than cropped to a user-selected region.
- macOS validates the focused control and attempts direct Accessibility write-back; known controls without AX write support fall back to validated paste. Without a recognized target, including on Windows/Linux, suggestions offer copying.
- Native foreground capture is verified on macOS. Windows uses its foreground-window API; Linux requires X11 and `xdotool`. Protected windows and unsupported capture environments can use Ask AI without page context.
- There is no browser DOM extension yet, so complex iframes, canvas editors, and some rich-text controls depend on the OS accessibility tree and screenshots.
- Channel support is based on visible windows, not historical OAuth message sync.
- Field-neighborhood cropping, richer nearby accessibility text, local OCR/redaction, voice input, and calendar actions are planned.
- The memory file is permission-restricted but not fully encrypted at rest; API keys are encrypted separately.
- Sessions use a static invocation-time snapshot, not a live page feed. Changes without a window-title change, including same-title tabs, cannot be reliably distinguished; refresh or invoke again after navigating. Sessions currently expire five minutes after creation. See [interaction flows and acceptance checks](./interaction-flows.md).

ContextCue is an early desktop MVP, inspired by OKEight's in-conversation reply workflow. See the [roadmap](../TODO.md) for production work and planned features.
