# README screenshots

These eight images render the **actual React suggestion, Ask AI, and Settings interfaces** in a browser. The three conversation scenes use a fictional team chat. The surrounding chat window is a documentation illustration, not a third-party integration. The Ask AI image leads the README; displayed shortcuts are the defaults for new installs (upgrades preserve saved shortcuts). Replies are deterministic fixtures, not examples measured from a live model. No personal data, OS screenshots, API keys, or model calls are used.

- `fixtures.mjs`: parallel English / Simplified Chinese conversations, candidates, instructions, questions, and answers.
- `preview.mjs`: injects fixture responses into the existing browser demo API before mounting `src/main.tsx`. It does not change application source or local user data.
- `stage.css`: illustration framing only. The embedded panels use `src/styles.css` unchanged.
- `capture-playwright.js`: captures conversation scenes at 1200 × 760 CSS pixels and Settings at 1200 × 1000, all at 2× resolution. Checks cover clipping, localized content, Ask → draft → revision → Ask → Open draft, page context toggling, and refresh.
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

To review a scene manually, open [the local preview](http://127.0.0.1:4187/scripts/readme/preview.html?scene=reply&locale=en). Set `scene` to `ask`, `reply`, `revise`, or `settings`, and `locale` to `en` or `zh-CN`. All conversation scenes open Ask AI first. Send the exact `draftRequest` from `fixtures.mjs` to open the localized draft; other questions show the prepared answer. Then use **Revise** to enter an instruction. The Settings scene starts on Home; click **Settings** to show General. No production model-routing code is replaced.

Inspect all eight images before committing. Keep English and Chinese scenarios equivalent, include no real customer conversations, and describe browser demo captures as illustrated demos rather than native OS captures. These checks validate documentation rendering only, not model quality, native capture, or cross-app insertion.
