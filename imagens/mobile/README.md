# Versões Mobile Otimizadas

Esta pasta contém versões otimizadas para dispositivos móveis de todas as imagens dos Stories.

## Especificações Mobile
- **Largura máxima**: 720px
- **Qualidade**: 80% (balanço qualidade/tamanho)
- **Formato**: JPEG otimizado para web
- **Objetivo**: Reduzir uso de dados em conexões móveis

## Estrutura de Nomenclatura

### Imagens Antes/Depois
- `antesedepois-1.jpg` até `antesedepois-11.jpg`
- Versões 720px max das imagens originais

### Imagens dos Stories  
- `story-1.jpg` - Cliente real (mobile)
- `story-2.jpg` - Como aplicar (mobile)
- `story-3.jpg` - Dermato (mobile)
- `story-4.jpg` - 30 dias depois (mobile)
- `story-5.jpg` - UGC 1 (mobile)
- `story-6.jpg` - UGC 2 (mobile)

## Como Gerar Versões Mobile

### Usando ImageMagick
```bash
# Redimensionar mantendo proporção, máximo 720px de largura
magick input.jpg -resize 720x720> -quality 80 output.jpg
```

### Usando FFmpeg (para extrair de vídeos)
```bash
# Extrair frame otimizado para mobile
ffmpeg -i input.mp4 -vf "scale=720:-1:force_original_aspect_ratio=decrease" -q:v 3 output.jpg
```

### Batch Processing
```bash
# Processar todas as imagens
for file in *.jpg; do
    magick "$file" -resize 720x720> -quality 80 "mobile/$file"
done
```

## Benefícios
- ⚡ **50-70% menor** que versões desktop
- 📱 **Carregamento rápido** em 3G/4G
- 💾 **Economia de dados** para usuários
- 🎯 **Qualidade adequada** para telas móveis
