# ContextCue website

The marketing site is intentionally isolated from the Electron renderer.

## Local development

```bash
cd website
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The static output is written to `website/dist` and can be deployed to Cloudflare Pages, Vercel, Netlify, or GitHub Pages.

## Download destination

Download links currently point to the latest GitHub Release:

```text
https://github.com/jastfkjg/ContextCue/releases/latest
```

Download buttons open an architecture picker. Its direct links use the stable release asset names `ContextCue-mac-arm64.dmg` and `ContextCue-mac-x64.dmg`, so publishing a new latest GitHub Release requires no website URL change.

## Languages

The site supports Simplified Chinese and English. It chooses a language in this order:

1. The `?lang=zh` or `?lang=en` query parameter
2. The visitor's last selection in local storage
3. The browser language

The header switch updates the document language, page metadata, product demo, and all visible copy without reloading the page.
