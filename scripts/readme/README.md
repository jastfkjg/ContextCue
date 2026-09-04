# README screenshots

These six illustrated demos render the **actual React suggestion and Ask AI panels** in a browser, over a fictional team conversation. The surrounding chat window is a documentation illustration, not a third-party integration. The Ask AI image leads the README; displayed shortcuts are the defaults for new installs (upgrades preserve saved shortcuts). Replies are deterministic fixtures, not examples measured from a live model. No personal data, OS screenshots, API keys, or model calls are used.

- `fixtures.mjs`: parallel English / Simplified Chinese conversations, candidates, instructions, questions, and answers.
- `preview.mjs`: injects fixture responses into the existing browser demo API before mounting `src/main.tsx`. It does not change application source or local user data.
- `stage.css`: illustration framing only. The embedded panels use `src/styles.css` unchanged.
- `capture-playwright.js`: captures each scene at 1200 × 760 CSS pixels and 2× resolution, checks for clipped panel text, and exercises revision and return-to-original behavior.
- `capture.mjs`: runs the capture through Playwright CLI, then copies the results from `output/playwright/` to `docs/images/readme/`.

The Chinese images use Chinese conversations and generated content. Controls retain their current English labels; these images do not imply that the app has a fully localized interface. Keep screenshot provenance and reproduction details in this document so the product READMEs stay focused on features and getting started.

## Regenerate

From the repository root, after `npm install`, start the local preview:

```bash
npx vite --config scripts/readme/vite.config.mjs
```

In a second terminal:

```bash
node scripts/readme/capture.mjs
```

This uses `npx --package @playwright/cli` without adding an app dependency. A Playwright-compatible Chromium browser must be available; if needed, install it with `npx --yes --package @playwright/cli playwright-cli install-browser chromium`. Chinese font rendering depends on installed system fonts; the checked-in images were captured on macOS.

To review a scene manually, open [the local preview](http://127.0.0.1:4187/scripts/readme/preview.html?scene=reply&locale=en). Set `scene` to `reply`, `revise`, or `ask`, and `locale` to `en` or `zh-CN`. For revision, click **Revise** and enter an instruction. For Ask AI, send a question to display the prepared answer.

Inspect all six images before committing. Keep English and Chinese scenarios equivalent, include no real customer conversations, and describe browser demo captures as illustrated demos rather than native OS captures. These checks validate documentation rendering only, not model quality, native capture, or cross-app insertion.
