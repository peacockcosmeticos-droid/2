const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIRS = [
  path.join(__dirname, '..', 'imagens'),
];

// Lista de arquivos individuais fora da pasta imagens a converter
const INPUT_FILES = [
  path.join(__dirname, '..', 'peecock.png'),
  path.join(__dirname, '..', 'fav.png'),
];
const OUTPUT_ROOT = path.join(__dirname, '..');

async function processImage(filePath) {
  const rel = path.relative(OUTPUT_ROOT, filePath).replace(/\\/g, '/');
  if (!/\.(jpe?g|png|webp)$/i.test(rel)) return;

  const { dir, name } = path.parse(filePath);
  const avifOut = path.join(dir, `${name}.avif`);
  const webpOut = path.join(dir, `${name}.webp`);

  // Skip if both formats exist
  if (fs.existsSync(avifOut) && fs.existsSync(webpOut)) return;

  const img = sharp(filePath);
  if (!fs.existsSync(avifOut)) {
    await img.avif({ quality: 60 }).toFile(avifOut);
  }
  if (!fs.existsSync(webpOut)) {
    await img.webp({ quality: 70 }).toFile(webpOut);
  }
  console.log('Optimized:', rel);
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else await processImage(p);
  }
}

(async () => {
  for (const d of INPUT_DIRS) {
    if (fs.existsSync(d)) await walk(d);
  }
  // Processar arquivos avulsos
  for (const f of INPUT_FILES) {
    if (fs.existsSync(f)) await processImage(f);
  }
})();

