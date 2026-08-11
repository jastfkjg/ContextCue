<div align="center">
  <img src="./build/icon.png" width="96" height="96" alt="ContextCue app icon" />
  <h1>ContextCue</h1>
  <p><strong>Replies that stay with the conversation.</strong></p>
  <p>A local-first desktop assistant that turns the chat in front of you into a few natural, send-ready replies.</p>

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

ContextCue reads a screenshot of the active conversation only when you invoke it. It combines that screenshot with a small, relevant slice of local memory, asks your configured vision model for several distinct replies, and shows them in a compact panel beside the chat input.

> [!IMPORTANT]
> ContextCue requires a model that supports **image input**. Text-only models may accept an OpenAI-compatible request while silently ignoring its image; ContextCue detects known text-only models and blocks context-free generation.

## At a glance

| | Capability | What it does |
|---|---|---|
| ⚡ | **Quick reply** | Press one global shortcut from the active chat—no jump to the main window. |
| 💬 | **Context-aware drafts** | Generate 2–5 structurally validated replies with meaningfully different strategies. |
| ↔️ | **Lightweight candidate panel** | Switch with a two-finger swipe, horizontal gesture, dots, or arrow keys. |
| ↵ | **Insert without sending** | Put the selected reply into the original chat input, ready for review. |
| 🧠 | **Explicit local memory** | Reuse profile, relationship, preference, and accepted-reply context without automatic memory writes. |
| ◉ | **Multiple model providers** | Configure several Responses or Chat Completions endpoints and choose the default model. |
| 🔒 | **OS-protected keys** | Encrypt each API key with Electron `safeStorage` and the operating-system keychain. |

Supported window detection includes **WeChat**, **Slack**, **Lark / Feishu**, **Gmail**, **Microsoft Teams**, **WhatsApp**, and other visible applications.

## How it works

```text
Active conversation
  └─ global shortcut
      └─ capture that window once
          └─ select relevant local memory
              └─ call the configured vision model
                  └─ validate 2–5 reply candidates
                      └─ swipe · copy · insert
```

The floating panel is bound to the originating application and window. Switching to another channel or browser tab hides it; returning to the original conversation restores it.

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

### First reply

1. Open **Settings → Models** and add a provider, API base URL, model ID, API format, and API key.
2. Confirm that **Image input** is marked as supported, then set that model as the default.
3. Grant Screen Recording permission when your operating system asks. Insertion also needs Accessibility / automation permission on macOS.
4. Open the conversation you want to answer and keep its input area visible.
5. Press `⌘ ⇧ Space` on macOS or `Ctrl ⇧ Space` on Windows / Linux.
6. Swipe between candidates and select the insert icon. ContextCue fills the chat input but never sends automatically.

The shortcut can be changed in Settings. If registration fails because another application already uses it, ContextCue keeps the previous shortcut.

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
| `acceptedReplies` | Up to 100 replies the user actually selected |
| `settings` | Model, candidate, language, shortcut, and overlay preferences |

For each generation, ContextCue selects only the matching relationship, relevant facts, and recent accepted replies from the same channel or contact. Model-suggested memories are always opt-in.

## Privacy boundaries

- A screenshot is captured only after the user invokes ContextCue from a conversation.
- Screenshots are sent to the configured model provider but are not written to the long-term memory file.
- Text inside screenshots is treated as untrusted conversation data, not as instructions.
- Long-term memory remains local except for the small relevant subset included in a generation request.
- Saved API keys are not exposed back to the renderer process.
- Insertion begins by copying the reply; if OS automation fails, manual paste remains available.
- ContextCue does not record the screen in the background and does not send messages automatically.

> [!NOTE]
> These are ContextCue's application boundaries, not a guarantee about a third-party provider. Review that provider's retention policy before processing sensitive conversations.

## Architecture

```text
Electron main process
  ├─ desktopCapturer / screencapture   visible-window capture
  ├─ globalShortcut                    system-wide invocation
  ├─ safeStorage                       per-model API-key encryption
  ├─ clipboard + OS automation         copy and best-effort insertion
  ├─ MemoryStore                       local JSON memory and migration
  └─ Model adapter                     Responses + Chat Completions

Typed preload bridge
  └─ narrow IPC surface

React renderer
  ├─ reply and capture workspace
  ├─ swipeable candidate carousel
  ├─ profile, relationships, and facts
  ├─ channel discovery
  ├─ multi-model settings
  └─ conversation-bound floating panel
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
- Cross-application insertion remains best-effort OS automation.
- Channel support is based on visible windows, not historical OAuth message sync.
- Local OCR/redaction, voice input, calendar actions, and native app-specific accessibility adapters are planned.
- The memory file is permission-restricted but not fully encrypted at rest; API keys are encrypted separately.

ContextCue is an early desktop MVP, inspired by OKEight's in-conversation reply workflow. See the [roadmap](./TODO.md) for production work and planned features.
