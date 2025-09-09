const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configurações de otimização
const OPTIMIZATION_CONFIG = {
  mobile: {
    width: 400,
    height: 400,
    quality: {
      jpeg: 80,
      webp: 85,
      avif: 70
    }
  },
  desktop: {
    width: 800,
    height: 800,
    quality: {
      jpeg: 85,
      webp: 90,
      avif: 75
    }
  }
};

// Diretórios
const INPUT_DIR = path.join(__dirname, '..', 'imagens', 'antesedepois', 'novas');
const OUTPUT_DIR = path.join(__dirname, '..', 'imagens', 'antesedepois');

async function optimizeImage(inputPath, outputBaseName, config) {
  const img = sharp(inputPath);
  
  // Redimensionar mantendo aspect ratio
  const resizedImg = img.resize(config.width, config.height, {
    fit: 'cover',
    position: 'center'
  });

  const outputs = [];

  // Gerar JPEG
  const jpegPath = path.join(OUTPUT_DIR, `${outputBaseName}.jpg`);
  await resizedImg.jpeg({ quality: config.quality.jpeg }).toFile(jpegPath);
  outputs.push(jpegPath);

  // Gerar WebP
  const webpPath = path.join(OUTPUT_DIR, `${outputBaseName}.webp`);
  await resizedImg.webp({ quality: config.quality.webp }).toFile(webpPath);
  outputs.push(webpPath);

  // Gerar AVIF
  const avifPath = path.join(OUTPUT_DIR, `${outputBaseName}.avif`);
  await resizedImg.avif({ quality: config.quality.avif }).toFile(avifPath);
  outputs.push(avifPath);

  return outputs;
}

async function processNewImages() {
  console.log('🚀 Iniciando otimização das novas imagens...');
  console.log('===============================================');

  // Verificar se o diretório de entrada existe
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Diretório não encontrado: ${INPUT_DIR}`);
    return;
  }

  // Listar arquivos JPEG na pasta novas
  const files = fs.readdirSync(INPUT_DIR)
    .filter(file => file.toLowerCase().endsWith('.jpeg'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  Nenhum arquivo JPEG encontrado na pasta novas');
    return;
  }

  console.log(`📁 Encontrados ${files.length} arquivos para processar`);
  console.log('');

  // Processar cada arquivo
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(INPUT_DIR, file);
    const outputBaseName = `${i + 1}`;

    console.log(`🔄 Processando: ${file} → ${outputBaseName}.{jpg,webp,avif}`);

    try {
      // Gerar versão desktop (padrão)
      const desktopOutputs = await optimizeImage(inputPath, outputBaseName, OPTIMIZATION_CONFIG.desktop);
      
      console.log(`   ✅ Desktop: ${desktopOutputs.length} formatos gerados`);

      // Verificar tamanhos dos arquivos gerados
      for (const outputPath of desktopOutputs) {
        const stats = fs.statSync(outputPath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        const format = path.extname(outputPath).substring(1).toUpperCase();
        console.log(`      ${format}: ${sizeKB} KB`);
      }

    } catch (error) {
      console.error(`   ❌ Erro ao processar ${file}:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Otimização concluída!');
  console.log('');
  console.log('📊 Resumo:');
  console.log(`   • ${files.length} imagens processadas`);
  console.log(`   • 3 formatos por imagem (JPEG, WebP, AVIF)`);
  console.log(`   • Total de arquivos gerados: ${files.length * 3}`);
}

// Executar se chamado diretamente
if (require.main === module) {
  processNewImages().catch(console.error);
}

module.exports = { processNewImages, OPTIMIZATION_CONFIG };
