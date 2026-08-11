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

After an unsigned DMG is uploaded to a GitHub Release, the website needs no URL change. If direct architecture-specific downloads are added later, update every element marked with `data-download` in `index.html` through `main.js`.
