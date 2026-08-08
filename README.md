# Hiply

Hiply is a local-first desktop reply assistant inspired by [OKEight](https://hiply.pages.dev/). It captures a conversation window that you explicitly select, sends that screenshot together with relevant long-term memory to a vision-capable language model, and returns multiple send-ready replies that you can swipe through, copy, or insert.

English is the default documentation. [中文说明](./README.zh-CN.md)

## What works today

- Capture visible application windows and screens with Electron's screen capture API.
- Detect and prioritize WeChat, Slack, Lark/Feishu, Gmail, Teams, and WhatsApp windows.
- Send a fresh screenshot to either the OpenAI Responses API or a compatible Chat Completions endpoint.
- Generate 2–5 structurally validated reply candidates with distinct strategies.
- Switch candidates with buttons, `←` / `→`, dots, or horizontal swipe gestures.
- Copy a reply or perform best-effort insertion into WeChat, Slack, Lark, and other apps.
- Open a compact always-on-top candidate panel after generation.
- Invoke Hiply globally with `CommandOrControl+Shift+Space`.
- Save a local user profile, writing rules, relationship cards, durable facts, and follow-ups.
- Learn from replies the user explicitly accepts; accepted replies become future style examples.
- Review model-suggested memories before saving them. Nothing is added automatically.
- Store API keys using Electron `safeStorage` (the operating-system keychain).

The desktop client is functional. The browser build includes a non-networked preview dataset so the interface can be reviewed without Electron; real screenshots, global shortcuts, secure key storage, and insertion require the Electron app.

## Product flow

```text
Global shortcut
  → choose a WeChat / Slack / Lark / other visible window
  → capture a fresh screenshot
  → combine it with explicit user intent and relevant local memory
  → send one multimodal request to the configured model
  → validate 2–5 candidates
  → swipe, copy, or insert one candidate
  → remember only the reply the user actually chose
```

## Quick start

Requirements:

- Node.js 20+
- npm 10+
- macOS, Windows, or Linux
- A vision-capable model API key

```bash
npm install
npm run dev
```

Then:

1. Open **Settings**.
2. Enter an API base URL, model name, protocol, and API key.
3. On macOS, allow Screen Recording when prompted, then restart Hiply.
4. Open a conversation in WeChat, Slack, Lark, or another app.
5. Press `CommandOrControl+Shift+Space`, select the window, optionally describe your intent, and choose **Generate replies**.

The default endpoint is `https://api.openai.com/v1`, using the Responses API and `gpt-5.6-luna`. The model can be changed in Settings. OpenAI's current model catalog states that the latest model family accepts image input through the Responses API: [OpenAI models](https://developers.openai.com/api/docs/models).

Environment variables can be used instead of entering a key in the interface:

```bash
cp .env.example .env
export HIPLY_API_KEY="your-key"
export HIPLY_API_BASE_URL="https://api.openai.com/v1"
export HIPLY_MODEL="gpt-5.6-luna"
npm run dev
```

Do not commit `.env` files.

## Building

```bash
# Type-check and build Electron main, preload, and renderer bundles
npm run build

# Build an unpacked application directory
npm run package

# Create platform installers
npm run dist
```

Code signing and notarization are not configured in this repository yet.

## Memory model

Hiply stores memory at Electron's platform-specific `userData` location in `hiply-data.json`.

The local memory contains:

- `profile`: stable personal context, language, writing style, and global rules;
- `contacts`: relationship-specific tone, notes, and channel;
- `facts`: explicitly saved personal facts, preferences, and follow-ups;
- `acceptedReplies`: up to 100 replies the user actually selected;
- `settings`: model and interaction preferences.

For every generation, Hiply selects the matching relationship, relevant facts, and up to six accepted replies from the same channel/contact. The full memory database is not sent blindly. API keys are stored separately as an encrypted `safeStorage` payload or read from `HIPLY_API_KEY`.

Model-generated memory suggestions are deliberately opt-in. The UI explains that nothing is saved automatically.

## Security and privacy boundaries

- Hiply captures only after the user selects a source and presses Generate.
- Screenshots are sent to the configured model provider; they do not remain in the local memory file.
- Text inside screenshots is treated as untrusted data. The system prompt explicitly rejects instructions found inside the screenshot.
- Long-term memory stays on the device, except for the small relevant subset included in a generation request.
- API keys are never exposed through the renderer API after saving.
- Direct insertion always starts by copying to the clipboard; if OS automation fails, the reply remains available to paste manually.

This is an application architecture, not a guarantee about a third-party model provider. Review the provider's data retention policy before sending sensitive conversations.

## Architecture

```text
electron/main.ts
  ├─ desktopCapturer          window/screen screenshots
  ├─ globalShortcut           system-wide invocation
  ├─ safeStorage              encrypted API key
  ├─ clipboard + OS scripts   copy / best-effort insertion
  ├─ MemoryStore              local JSON memory
  └─ Model adapter            Responses + Chat Completions

electron/preload.ts
  └─ narrow, typed IPC bridge

src/
  ├─ Reply workspace          capture, intent, generation
  ├─ Candidate carousel       swipe / keys / insert
  ├─ Memory workspace         profile, relationships, facts
  ├─ Channels workspace       WeChat / Slack / Lark discovery
  ├─ Settings                 provider, model, shortcut
  └─ Floating overlay         always-on-top candidates
```

## Development commands

```bash
npm run dev          # Electron development mode
npm run lint         # TypeScript validation
npm test             # Unit tests
npm run build        # Production bundles
npm run test:watch   # Watch-mode tests
```

Tests cover channel detection, memory persistence/deduplication, relevant-memory selection, structured model parsing, and multimodal request construction.

## Current limitations

- Window screenshots are currently resized to 1440×900; selectable crop regions are planned.
- Insertion is best-effort OS automation. Copy always remains available as a fallback.
- Slack, Lark, and WeChat are supported through their visible windows, not historical OAuth sync.
- Voice dictation, local OCR/redaction, calendar actions, and double-tap/hold Option interactions are planned in [TODO.md](./TODO.md).
- The complete memory file is permission-restricted but not yet encrypted at rest; the API key is encrypted separately.

## Project status

This repository is an early desktop MVP. See [TODO.md](./TODO.md) for the production roadmap and known engineering work.
