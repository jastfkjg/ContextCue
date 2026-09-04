# ContextCue icon assets

`icon-reference.png` preserves the approved ImageGen preview. `icon.svg` is the
editable vector master traced from that preview, with the white presentation
background removed and transparent padding for native app packaging. The two
diagonal tips, nested-C proportions, and compact spacing are intentional.

Run `npm run icons` from the project root after editing the master. The script
uses the installed Electron runtime to render transparent PNGs and regenerates:

- `icon.png`, `icon.ico`, `icon.icns`, and `icons/*x*.png`
- `tray-icon.svg`, `tray-icon.png`, `tray-icon@2x.png`, and `tray-icon-data.json`
- `../website/public/contextcue-icon.svg`

The menu-bar version uses the same two paths in monochrome, with 1x and 2x PNG
representations embedded into the Electron main bundle through the generated
JSON. It is a macOS template image, so the system supplies the appropriate color.

Generated files are committed so normal builds do not need to regenerate icons.
The reference image is for design provenance only, not a runtime dependency.
