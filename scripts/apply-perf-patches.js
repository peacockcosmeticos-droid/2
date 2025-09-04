const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

function replaceImgWithPicture(html, srcRegex, sources) {
  return html.replace(srcRegex, (m, pre, post) => {
    // Monta <picture> mantendo atributos originais do <img>
    const picture = [
      '<picture>',
      ...sources.map(s => `<source srcset="${s.src}" type="${s.type}">`),
      `<img${pre}src="${sources[sources.length - 1].fallback}"${post}>`,
      '</picture>'
    ].join('');
    return picture;
  });
}

function ensurePreloadAvif(html, avifHref) {
  // Atualiza preload existente de 78.jpg -> 78.avif ou insere novo após <head>
  if (html.includes(`href="${avifHref}"`)) return html;
  html = html.replace(/<link[^>]+rel="preload"[^>]+as="image"[^>]*>/i, (m) => {
    if (/href=.*78\.(?:jpg|jpeg|png)/i.test(m)) {
      return m.replace(/href="[^"]+"/i, `href="${avifHref}"`);
    }
    return m;
  });
  if (!html.includes(`href="${avifHref}"`)) {
    html = html.replace('<head>', `<head><link rel="preload" as="image" href="${avifHref}" fetchpriority="high">`);
  }
  return html;
}

function ensurePreconnects(html) {
  const hints = [
    '<link rel="preconnect" href="https://www.googletagmanager.com">',
    '<link rel="preconnect" href="https://connect.facebook.net">',
    '<link rel="preconnect" href="https://scripts.clarity.ms">'
  ];
  let out = html;
  let inserted = false;
  for (const h of hints) {
    if (!out.includes(h)) { inserted = true; out = out.replace('<head>', `<head>${h}`); }
  }
  return out;
}

(function main(){
  let html = fs.readFileSync(INDEX, 'utf8');

  // 1) Logo peecock.png -> picture com avif/webp
  const logoRegex = /<img\b([^>]*?)src="\.\/peecock\.png"([^>]*?)>/i;
  if (logoRegex.test(html)) {
    html = replaceImgWithPicture(html, logoRegex, [
      { src: './peecock.avif', type: 'image/avif', fallback: './peecock.png' },
      { src: './peecock.webp', type: 'image/webp', fallback: './peecock.png' },
    ]);
  }

  // 2) Footer logo também (se existir múltiplos, aplicar globalmente)
  html = html.replace(new RegExp(logoRegex, 'gi'), (m) => m); // já coberto pelo replace acima (uma vez)

  // 3) LCP ./imagens/78.jpg -> picture com avif/webp (primeira ocorrência)
  const lcpRegex = /<img\b([^>]*?)src="\.\/imagens\/78\.jpg"([^>]*?)>/i;
  if (lcpRegex.test(html)) {
    html = replaceImgWithPicture(html, lcpRegex, [
      { src: './imagens/78.avif', type: 'image/avif', fallback: './imagens/78.jpg' },
      { src: './imagens/78.webp', type: 'image/webp', fallback: './imagens/78.jpg' },
    ]);
  }

  // 4) Preload do AVIF da LCP
  html = ensurePreloadAvif(html, './imagens/78.avif');

  // 5) Preconnect para GTM/FB/Clarity (como você quer registrar cedo)
  html = ensurePreconnects(html);

  fs.writeFileSync(INDEX, html);
  console.log('Patches aplicados em index.html');
})();

