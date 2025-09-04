const { optimize } = require('svgo');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'imagens', 'icons');

function minifySvgFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const result = optimize(content, {
    multipass: true,
    plugins: [
      'preset-default',
      { name: 'removeDimensions', active: false },
      { name: 'convertStyleToAttrs', active: true },
      { name: 'removeViewBox', active: false },
    ],
  });
  fs.writeFileSync(file, result.data);
  console.log('Minified:', path.relative(path.join(__dirname, '..'), file));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (/\.svg$/i.test(e.name)) minifySvgFile(fp);
  }
}

walk(ICONS_DIR);

