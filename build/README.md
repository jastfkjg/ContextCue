# ContextCue icon assets

`icon-reference.png` preserves the approved **A2 · Soft chamfer** ImageGen
preview. `icon.svg` is the editable vector master traced from that preview.
It keeps the two nested Cs and their softly rounded chamfers, using flat lime
(`#D5F74B`) and charcoal (`#242520`) fills. The presentation background and
generated texture are removed; the tile is square with transparent padding for
native app packaging.

Run `npm run icons` from the project root after editing the master. The script
uses the installed Electron runtime to render transparent PNGs and regenerates:

- `icon.png`, `icon.ico`, `icon.icns`, and `icons/*x*.png`
- `tray-icon.svg`, `tray-icon.png`, `tray-icon@2x.png`, and `tray-icon-data.json`
- `../website/public/contextcue-icon.svg`

The menu-bar version fits the bounds of the same two paths in monochrome, with 1x and 2x PNG
representations embedded into the Electron main bundle through the generated
JSON. It is a macOS template image, so the system supplies the appropriate color.

Generated files are committed so normal builds do not need to regenerate icons.
The reference image is for design provenance only, not a runtime dependency.

Both product READMEs use `icon.png`. After a brand change, also regenerate their
eight screenshots with the [README capture workflow](../scripts/readme/README.md)
so the illustrated mastheads and embedded application show the current icon.
