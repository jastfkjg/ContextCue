<div align="center">
  <img src="./build/icon.png" width="80" height="80" alt="ContextCue app icon" />
  <h1>ContextCue</h1>
  <p><strong>Ask and write from your screen. Skip copying the background.</strong></p>
  <p>Your current screen, one entry for questions, drafts, and rewrites.</p>
  <p>
    <a href="https://github.com/jastfkjg/ContextCue/releases">Download for macOS</a>
    · <a href="#quick-start">Quick start</a>
    · <a href="./README.zh-CN.md">简体中文</a>
  </p>
  <p><strong>One shortcut</strong> · Your model provider · You decide what to send</p>
</div>

![ContextCue answers a question about the next steps in the visible team conversation.](./docs/images/readme/ask-en.png)

Press a shortcut to open **Ask AI** over the window you’re using. Ask “What do I need to do here?” or say “Draft a polite decline, leaving the door open.” Read explanations directly; writing requests become drafts you can revise, copy, or insert. A separate shortcut takes you straight to writing suggestions.

## What you can do

| When you need to… | ContextCue helps you… |
|---|---|
| **Understand a page** | Ask for a summary, explanation, or next steps in a compact AI conversation, with optional page context. |
| **Reply to a conversation** | Generate up to five alternatives from the visible context. Switch with arrow keys, dots, or a horizontal swipe. |
| **Find the right tone** | Ask for a shorter, warmer, or more direct version. Compare revised suggestions with the originals. |
| **Write beyond chat** | Draft text, rewrite a passage, complete a field, or compose a search query. |
| **Use your own model** | Connect an image-capable model through a Responses or Chat Completions endpoint; keep multiple configurations. |
| **Stay in control** | Review before copying or inserting. See provider-reported token usage locally. Nothing is sent or submitted automatically. |

Works from app and browser windows without a per-app integration. On macOS, recognized text fields support insertion; copying is available when insertion is not supported. Search assistance drafts queries; it does not browse the web.

## Quick start

### 1. Install or run locally

**macOS:** Open [Releases](https://github.com/jastfkjg/ContextCue/releases), download the DMG for **Apple Silicon (`arm64`)** or **Intel (`x64`)**, and move ContextCue to Applications. Check the release notes for signing and first-launch instructions; early-access builds may not be notarized.

**From source:** Requires **Node.js 22.12+** and **npm 10+**.

```bash
git clone https://github.com/jastfkjg/ContextCue.git
cd ContextCue
npm install
npm run dev
```

macOS is the primary verified platform. Windows and Linux can run from source; Linux capture requires X11 and `xdotool`. Cross-app insertion is currently macOS-only.

### 2. Connect a model

The **Setup guide** walks you through adding a model and API key, verifying image input, checking screen access, and asking about or drafting a reply to a fictional conversation. macOS Accessibility permission is optional and enables insertion into supported fields.

Use a model that supports **image input** for suggestions and page-aware questions. Text-only models work for questions, drafts, and subsequent draft revisions in **Ask AI** when page context is off. Model requests, including setup verification, may incur provider charges. [Provider and environment configuration →](./docs/guide.md#model-providers)

Check screen recording and optional insertion access in **Settings → Permissions**. Test a window with a local screenshot preview, or expand Window diagnostics to scan sources. No model request is sent by these checks.

### 3. Open a window and call ContextCue

| Action | macOS | Windows / Linux |
|---|---|---|
| Open Ask AI (main entry) | `⌘ ⇧ Space` | `Ctrl ⇧ Space` |
| Generate writing suggestions directly | `⌘ ⇧ Enter` | `Ctrl ⇧ Enter` |
| Switch suggestions | `←` / `→` | `←` / `→` |
| Apply the selected suggestion¹ | `Enter` | `Enter` |
| Submit revision instructions | `⌘ Enter` | `Ctrl Enter` |
| Close the composer or panel | `Esc` | `Esc` |

¹ Outside text inputs, with the revision composer closed. Inserts into a recognized macOS field, otherwise copies. It never sends the message. These are defaults for new installs; upgrades preserve existing shortcuts. Both global shortcuts are configurable in **Settings**.

## See it in action

### From a question to a usable draft

Open **Ask AI** to ask “What do I need to do before the review?” or “Explain this page.” Answers stream into the panel, and you can ask follow-up questions. Writing requests open usable drafts with **Revise**, Copy / Insert, and a path back to the same conversation. Toggle the page chip to include or exclude the captured page for your next request; hover to see its capture time.

![ContextCue offers reply candidates you can revise, copy, or insert.](./docs/images/readme/reply-en.png)

Each invocation starts a fresh session. The snapshot stays fixed during that session. Use the refresh button in Ask AI to capture the original window again and start a new conversation; this clears the old conversation and drafts. Failed refreshes preserve your work. Invoke with the shortcut on another window to start there. Turning page context off excludes the screenshot and page metadata from the next request; earlier answers in that session can still provide context.

### Make a draft sound like you

Choose **Revise**, describe the change, and get fresh alternatives in the same panel. Start with **Shorter**, **Warmer**, or **More direct**, or write your own instruction. You can return to the original suggestions at any time.

![The real ContextCue revision composer with an English draft and the instruction: Make it shorter and friendlier. Keep the meeting time.](./docs/images/readme/revise-en.png)

## Your context, your choice

- **Capture on invocation.** ContextCue does not record your screen in the background. A new invocation or explicit refresh takes a new snapshot.
- **Your chosen provider.** Screenshots and relevant text are sent to the model endpoint you configure when used in a request. “Local-first” describes storage; inference may run remotely.
- **Local settings and history.** Settings, memory documents, and usage records stay on your device. Saved memory and past accepted replies are excluded from page-only suggestions and Q&A. API keys are encrypted with OS-backed storage; the entire data file is not encrypted.
- **You approve the words.** Copy or insert explicitly. ContextCue never submits a form or sends a message for you. Screenshots are not automatically redacted.

[Privacy details](./docs/guide.md#privacy-boundaries) · [Platform and capture limitations](./docs/guide.md#current-limitations)

## Development and documentation

Built with **Electron, React, and TypeScript**.

```bash
npm run lint     # TypeScript validation
npm test         # Unit tests
npm run build    # Build the desktop app
npm run package  # Create an unpacked application
```

| Explore | Details |
|---|---|
| [User guide](./docs/guide.md) | Setup, model providers, local memory, token usage, architecture, and all development commands |
| [Interaction flows](./docs/interaction-flows.md) | Session boundaries, revisions, and acceptance checks |
| [Updates and releases](./docs/updates.md) | Packaging, signing, and in-app updates |
| [Roadmap](./TODO.md) | Current priorities and planned features |

ContextCue is an early desktop MVP. Found something that could work better? [Open an issue](https://github.com/jastfkjg/ContextCue/issues).
