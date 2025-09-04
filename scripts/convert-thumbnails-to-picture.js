const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

function convertThumbs(html) {
  // Converte apenas <img ... class="...thumbnail..." ... src="./imagens/[1-6].jpg" ...>
  // Mantém todos os outros atributos (class, data-main, etc.)
  const re = /<img([^>]*\bclass="[^"]*\bthumbnail\b[^"]*"[^>]*?)\s+src="\.\/imagens\/([1-6])\.jpg"([^>]*?)>/g;
  return html.replace(re, (m, pre, num, post) => {
    return (
      `<picture>`+
      `<source srcset="./imagens/${num}.avif" type="image/avif">`+
      `<source srcset="./imagens/${num}.webp" type="image/webp">`+
      `<img${pre} src="./imagens/${num}.jpg"${post}>`+
      `</picture>`
    );
  });
}

(function main(){
  if (!fs.existsSync(INDEX)) {
    console.error('index.html não encontrado:', INDEX);
    process.exit(1);
  }
  const before = fs.readFileSync(INDEX, 'utf8');
  const after = convertThumbs(before);
  if (before === after) {
    console.log('Nenhuma miniatura encontrada para converter.');
  } else {
    fs.writeFileSync(INDEX, after);
    console.log('Miniaturas convertidas para <picture> (AVIF/WebP + fallback).');
  }
})();

