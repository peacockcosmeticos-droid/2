const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const ROOT = path.join(__dirname, '..');

(async () => {
  const files = fs.readdirSync(ROOT).filter(f => /\.(html)$/i.test(f));
  for (const f of files) {
    const fp = path.join(ROOT, f);
    const html = fs.readFileSync(fp, 'utf8');
    const out = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      keepClosingSlash: true
    });
    fs.writeFileSync(fp, out);
    console.log('Minified HTML:', f);
  }
})();

