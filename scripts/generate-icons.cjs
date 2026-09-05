/** Regenerate every icon from build/icon.svg using the project's Electron runtime. */
const { readFileSync, writeFileSync, copyFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

if (!process.versions.electron) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  execFileSync(require('electron'), [__filename], { env, stdio: 'inherit' });
} else {
  const { app, BrowserWindow, nativeImage } = require('electron');
  const root = resolve(__dirname, '..');
  const build = join(root, 'build');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

  // PNG-backed ICO supports all target sizes without another image dependency.
  function ico(images) {
    const header = Buffer.alloc(6 + images.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let offset = header.length;
    images.forEach(({ size, png }, index) => {
      const entry = 6 + index * 16;
      header[entry] = header[entry + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(png.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += png.length;
    });
    return Buffer.concat([header, ...images.map(({ png }) => png)]);
  }

  // Modern macOS ICNS elements contain PNG data, including explicit Retina slots.
  function icns(pngs) {
    const types = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512 };
    const chunks = Object.entries(types).map(([type, size]) => {
      const png = pngs.get(size);
      const header = Buffer.alloc(8);
      header.write(type);
      header.writeUInt32BE(png.length + 8, 4);
      return Buffer.concat([header, png]);
    });
    const header = Buffer.alloc(8);
    header.write('icns');
    header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
    return Buffer.concat([header, ...chunks]);
  }

  app.whenReady().then(async () => {
    app.dock?.hide();
    const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try {
      await window.loadURL('about:blank');
      const svg = readFileSync(join(build, 'icon.svg'), 'utf8');
      const paths = svg.match(/<g id="monogram-shape"[^>]*>([\s\S]*?)<\/g>/)?.[1];
      if (!paths || (paths.match(/<path /g) || []).length !== 2) throw new Error('Expected the approved two-path CC monogram.');
      // Fit the actual monogram bounds, independently of the app tile's padding
      // and transforms, so a new master cannot clip the menu-bar exports.
      const bounds = await window.webContents.executeJavaScript(`(() => {
        const svg = new DOMParser().parseFromString(${JSON.stringify(svg)}, 'image/svg+xml').documentElement;
        document.body.appendChild(svg);
        const { x, y, width, height } = svg.querySelector('#monogram-shape').getBBox();
        svg.remove();
        return { x, y, width, height };
      })()`);
      if (!(bounds.width > 0 && bounds.height > 0)) throw new Error('Invalid monogram bounds.');
      const trayScale = 34 / Math.max(bounds.width, bounds.height);
      const trayX = (36 - bounds.width * trayScale) / 2;
      const trayY = (36 - bounds.height * trayScale) / 2;
      const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><title>ContextCue menu-bar icon</title><g fill="#000" transform="translate(${trayX} ${trayY}) scale(${trayScale}) translate(${-bounds.x} ${-bounds.y})">${paths}</g></svg>\n`;
      const render = async (source, size) => {
        const data = await window.webContents.executeJavaScript(`(async () => {
          const image = new Image();
          image.src = ${JSON.stringify('data:image/svg+xml;base64,' + Buffer.from(source).toString('base64'))};
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = ${size};
          canvas.getContext('2d').drawImage(image, 0, 0, ${size}, ${size});
          return canvas.toDataURL('image/png').split(',')[1];
        })()`);
        const png = Buffer.from(data, 'base64');
        const image = nativeImage.createFromBuffer(png);
        if (image.isEmpty() || image.getSize().width !== size || image.getSize().height !== size) throw new Error(`Invalid ${size}px icon`);
        return png;
      };
      mkdirSync(join(build, 'icons'), { recursive: true });
      const pngs = new Map();
      for (const size of sizes) {
        const png = await render(svg, size);
        pngs.set(size, png);
        writeFileSync(join(build, 'icons', `${size}x${size}.png`), png);
      }
      writeFileSync(join(build, 'icon.png'), pngs.get(1024));
      writeFileSync(join(build, 'icon.ico'), ico(sizes.filter(size => size <= 256).map(size => ({ size, png: pngs.get(size) }))));
      writeFileSync(join(build, 'icon.icns'), icns(pngs));
      writeFileSync(join(build, 'tray-icon.svg'), traySvg);
      const tray1x = await render(traySvg, 18);
      const tray2x = await render(traySvg, 36);
      const tray = nativeImage.createEmpty();
      tray.addRepresentation({ scaleFactor: 1, buffer: tray1x });
      tray.addRepresentation({ scaleFactor: 2, buffer: tray2x });
      tray.setTemplateImage(true);
      if (tray.getSize().width !== 18 || tray.getScaleFactors().join(',') !== '1,2' || !tray.isTemplateImage()) {
        throw new Error('Invalid native menu-bar image representations.');
      }
      writeFileSync(join(build, 'tray-icon.png'), tray1x);
      writeFileSync(join(build, 'tray-icon@2x.png'), tray2x);
      writeFileSync(join(build, 'tray-icon-data.json'), JSON.stringify({
        png1x: tray1x.toString('base64'),
        png2x: tray2x.toString('base64')
      }, null, 2) + '\n');
      copyFileSync(join(build, 'icon.svg'), join(root, 'website/public/contextcue-icon.svg'));
      console.log('Generated app PNG / ICO / ICNS, nine PNG sizes, 1x / 2x template tray icons, and website SVG.');
    } finally {
      window.destroy();
    }
  }).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
}
