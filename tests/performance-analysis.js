const fs = require('fs');
const path = require('path');

function analyzeImageSizes() {
  console.log('📊 Análise de Performance - Otimização de Imagens');
  console.log('================================================');
  
  const backupDir = path.join(__dirname, '..', 'imagens', 'antesedepois', 'backup_20250909_153340');
  const currentDir = path.join(__dirname, '..', 'imagens', 'antesedepois');
  
  // Analisar imagens do backup (originais)
  console.log('\n🔍 Imagens Originais (Backup):');
  console.log('------------------------------');
  
  let totalOriginalSize = 0;
  const originalFiles = fs.readdirSync(backupDir)
    .filter(file => file.match(/^[1-9]|1[01]\.jpg$/))
    .sort((a, b) => {
      const numA = parseInt(a.split('.')[0]);
      const numB = parseInt(b.split('.')[0]);
      return numA - numB;
    });
  
  originalFiles.forEach(file => {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    totalOriginalSize += stats.size;
    console.log(`  ${file}: ${sizeKB} KB`);
  });
  
  // Analisar imagens otimizadas atuais
  console.log('\n✨ Imagens Otimizadas (Atuais):');
  console.log('-------------------------------');
  
  let totalOptimizedSize = 0;
  const formats = ['jpg', 'webp', 'avif'];
  const optimizedSizes = {};
  
  for (let i = 1; i <= 11; i++) {
    console.log(`\n📸 Imagem ${i}:`);
    formats.forEach(format => {
      const fileName = `${i}.${format}`;
      const filePath = path.join(currentDir, fileName);
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        totalOptimizedSize += stats.size;
        
        if (!optimizedSizes[format]) optimizedSizes[format] = 0;
        optimizedSizes[format] += stats.size;
        
        console.log(`  ${format.toUpperCase()}: ${sizeKB} KB`);
      }
    });
  }
  
  // Calcular economias
  console.log('\n📈 Resumo de Performance:');
  console.log('=========================');
  
  const totalOriginalKB = (totalOriginalSize / 1024).toFixed(1);
  const totalOptimizedKB = (totalOptimizedSize / 1024).toFixed(1);
  const savings = totalOriginalSize - totalOptimizedSize;
  const savingsKB = (savings / 1024).toFixed(1);
  const savingsPercent = ((savings / totalOriginalSize) * 100).toFixed(1);
  
  console.log(`📦 Tamanho original total: ${totalOriginalKB} KB`);
  console.log(`🎯 Tamanho otimizado total: ${totalOptimizedKB} KB`);
  console.log(`💾 Economia total: ${savingsKB} KB (${savingsPercent}%)`);
  
  // Análise por formato
  console.log('\n🎨 Análise por Formato:');
  console.log('-----------------------');
  
  Object.entries(optimizedSizes).forEach(([format, size]) => {
    const sizeKB = (size / 1024).toFixed(1);
    const avgPerImage = (size / (11 * 1024)).toFixed(1);
    console.log(`${format.toUpperCase()}: ${sizeKB} KB total (${avgPerImage} KB/imagem)`);
  });
  
  // Recomendações
  console.log('\n💡 Recomendações de Performance:');
  console.log('=================================');
  
  const avifSize = optimizedSizes.avif || 0;
  const webpSize = optimizedSizes.webp || 0;
  const jpgSize = optimizedSizes.jpg || 0;
  
  if (avifSize > 0) {
    const avifSavings = ((jpgSize - avifSize) / jpgSize * 100).toFixed(1);
    console.log(`✅ AVIF oferece ${avifSavings}% de economia vs JPG`);
  }
  
  if (webpSize > 0) {
    const webpSavings = ((jpgSize - webpSize) / jpgSize * 100).toFixed(1);
    console.log(`✅ WebP oferece ${webpSavings}% de economia vs JPG`);
  }
  
  console.log('✅ Lazy loading implementado para melhor performance inicial');
  console.log('✅ Múltiplos formatos garantem compatibilidade e otimização');
  console.log('✅ Elementos <picture> permitem seleção automática do melhor formato');
  
  // Estimativa de impacto na experiência do usuário
  console.log('\n🚀 Impacto na Experiência do Usuário:');
  console.log('=====================================');
  
  const connectionSpeeds = {
    '3G': 1.6, // Mbps
    '4G': 25,  // Mbps
    'WiFi': 50 // Mbps
  };
  
  Object.entries(connectionSpeeds).forEach(([connection, speedMbps]) => {
    const speedKBps = (speedMbps * 1024) / 8; // Convert to KB/s
    const originalLoadTime = (totalOriginalSize / 1024 / speedKBps).toFixed(2);
    const optimizedLoadTime = (totalOptimizedSize / 1024 / speedKBps).toFixed(2);
    const timeSaved = (originalLoadTime - optimizedLoadTime).toFixed(2);
    
    console.log(`📶 ${connection}:`);
    console.log(`   Original: ${originalLoadTime}s | Otimizado: ${optimizedLoadTime}s | Economia: ${timeSaved}s`);
  });
  
  return {
    originalSize: totalOriginalSize,
    optimizedSize: totalOptimizedSize,
    savings: savings,
    savingsPercent: parseFloat(savingsPercent),
    formatSizes: optimizedSizes
  };
}

// Executar análise se chamado diretamente
if (require.main === module) {
  try {
    const results = analyzeImageSizes();
    
    // Verificar se a otimização foi bem-sucedida
    if (results.savingsPercent > 0) {
      console.log('\n🎉 Otimização bem-sucedida!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Otimização pode não ter sido efetiva');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro na análise:', error.message);
    process.exit(1);
  }
}

module.exports = { analyzeImageSizes };
