<div align="center">
  <img src="./build/icon.png" width="96" height="96" alt="ContextCue app icon" />
  <h1>ContextCue</h1>
  <p><strong>AI suggestions that stay with the focused field.</strong></p>
  <p>A local-first desktop writing assistant for replies, forms, composition, rewriting, search, and generic text completion.</p>

  <p>
    <img alt="Electron" src="https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-18-20232A?logo=react&logoColor=61DAFB" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
    <img alt="Local first" src="https://img.shields.io/badge/local--first-by%20default-C8FF3D?labelColor=24251F&color=C8FF3D" />
  </p>

  <p>
    <a href="./README.zh-CN.md">简体中文</a>
    · <a href="#quick-start">Quick start</a>
    · <a href="#privacy-boundaries">Privacy</a>
    · <a href="./TODO.md">Roadmap</a>
  </p>
</div>

---

ContextCue reads a screenshot of the active window only when you invoke it. On macOS it also inspects the focused editable control, combines that context with a small slice of local memory, and shows task-aware suggestions beside the original field.

> [!IMPORTANT]
> ContextCue requires a model that supports **image input**. Text-only models may accept an OpenAI-compatible request while silently ignoring its image; ContextCue detects known text-only models and blocks context-free generation.

## At a glance

| | Capability | What it does |
|---|---|---|
| ⚡ | **Any-field invocation** | Press one global shortcut from a chat, form, editor, or search field. |
| ✦ | **Streaming Ask AI** | Open a compact question panel with a second shortcut or continue from generated suggestions. |
| ✦ | **Task-aware drafts** | Route between reply, form, compose, rewrite, search, and generic completion. |
| ↔️ | **Lightweight candidate panel** | Switch with a two-finger swipe, horizontal gesture, dots, or arrow keys. |
| ↵ | **Apply without submitting** | On macOS, validate the original control before inserting or replacing text. |
| 🧠 | **Explicit local memory** | Reuse profile, relationship, preference, and accepted-suggestion context without automatic memory writes. |
| ◉ | **Multiple model providers** | Configure several Responses or Chat Completions endpoints and choose the default model. |
| 🔒 | **OS-protected keys** | Encrypt each API key with Electron `safeStorage` and the operating-system keychain. |

Supported window detection includes **WeChat**, **Slack**, **Lark / Feishu**, **Gmail**, **Microsoft Teams**, **WhatsApp**, and other visible applications.

## How it works

```text
Focused text control
  └─ global shortcut
      └─ read control metadata and capture that window once
          └─ select relevant local memory
              └─ classify the writing task and call the vision model
                  └─ validate 1–5 suggestions
                      └─ swipe · copy · apply
```

The floating panel is bound to the originating application, window, and—on macOS—focused control. Changing the target invalidates the panel.

Ask AI uses `⌘ ⇧ Enter` / `Ctrl ⇧ Enter` by default. Its optional current-page context stays only in the short-lived overlay session, answers stream into the panel, and closing the panel clears the screenshot and in-memory Q&A.

## Quick start

### Requirements

- Node.js 22.12+
- npm 10+
- macOS, Windows, or Linux
- An API key for a model that accepts image input

### Run locally

```bash
git clone https://github.com/jastfkjg/ContextCue.git
cd ContextCue
npm install
npm run dev
```

### First suggestion

1. Open **Settings → Models** and add a provider, API base URL, model ID, API format, and API key.
2. Confirm that **Image input** is marked as supported, then set that model as the default.
3. Grant Screen Recording permission when your operating system asks. Insertion also needs Accessibility / automation permission on macOS.
4. Open an app or page and place the cursor in the text field you want to use.
5. Press `⌘ ⇧ Space` on macOS or `Ctrl ⇧ Space` on Windows / Linux.
6. Swipe between candidates and apply one. ContextCue writes into the field but never submits automatically.

To ask a quick question instead, press `⌘ ⇧ Enter` / `Ctrl ⇧ Enter`, or choose **Ask AI** from the suggestion panel. Both shortcuts can be changed in Settings. If either registration fails, ContextCue keeps both previous shortcuts.

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

## Model providers

Each saved model has its own endpoint, protocol, image-input capability, and securely stored API key.

| API format | Use it when |
|---|---|
| **Responses API** | The provider explicitly supports an OpenAI-style `/responses` endpoint. |
| **Chat Completions** | The provider exposes a compatible `/chat/completions` endpoint, including many hosted and local services. |

The connection test verifies endpoint access and credentials. Image capability is recorded separately because some compatible providers accept multimodal-shaped JSON but discard unsupported image parts without returning an error. Known DeepSeek text models are marked text-only during settings migration; unknown providers can be corrected in Settings.

## Local memory

ContextCue stores its data in Electron's platform-specific `userData/contextcue-data.json`:

| Data | Purpose |
|---|---|
| `profile` | Stable personal context, language, writing style, and global rules |
| `contacts` | Relationship-specific tone, notes, and channel |
| `facts` | Explicitly saved preferences, durable facts, and follow-ups |
| `acceptedReplies` | Backward-compatible storage for up to 100 accepted suggestions, including task and target metadata |
| `settings` | Model, candidate, language, shortcut, and overlay preferences |

For each generation, ContextCue selects only the matching relationship, relevant facts, and recent accepted replies from the same channel or contact. Model-suggested memories are always opt-in.

## Privacy boundaries

- A screenshot is captured only after the user invokes ContextCue from a focused field.
- Screenshots are sent to the configured model provider but are not written to the long-term memory file.
- Text inside screenshots and page metadata is treated as untrusted data, not as instructions.
- Long-term memory remains local except for the small relevant subset included in a generation request.
- Saved API keys are not exposed back to the renderer process.
- Sensitive fields such as passwords and verification codes are blocked before model generation.
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
  ├─ swipeable candidate carousel
  ├─ profile, relationships, and facts
  ├─ channel discovery
  ├─ multi-model settings
  └─ input-target-bound floating panel
```

The browser build uses a non-networked preview dataset for UI review. Real screenshots, global shortcuts, secure key storage, and cross-application insertion require Electron.

## Development

| Command | Purpose |
|---|---|
| `npm run dev` | Start Electron in development mode |
| `npm run lint` | Run TypeScript validation |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Build main, preload, and renderer bundles |
| `npm run package` | Create an unpacked desktop application |
| `npm run dist` | Create platform installers |

Code signing and notarization are not configured yet.

## Current limitations

- Screenshots are resized rather than cropped to a user-selected region.
- macOS validates the focused control and attempts direct Accessibility write-back; unsupported controls fall back to paste, while Windows/Linux remain best-effort.
- There is no browser DOM extension yet, so complex iframes, canvas editors, and some rich-text controls depend on the OS accessibility tree and screenshots.
- Channel support is based on visible windows, not historical OAuth message sync.
- Field-neighborhood cropping, richer nearby accessibility text, local OCR/redaction, voice input, and calendar actions are planned.
- The memory file is permission-restricted but not fully encrypted at rest; API keys are encrypted separately.

ContextCue is an early desktop MVP, inspired by OKEight's in-conversation reply workflow. See the [roadmap](./TODO.md) for production work and planned features.
