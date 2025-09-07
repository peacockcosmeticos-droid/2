# Thumbnails para Círculos dos Stories

Esta pasta contém versões otimizadas (80x80px) das imagens para exibir nos círculos dos avatares.

## Estrutura de Nomenclatura

### Imagens Antes/Depois
- `antesedepois-1.jpg` até `antesedepois-11.jpg`
- Versões 80x80px das imagens originais de `../antesedepois/`

### Imagens dos Stories
- `story-1.jpg` - Cliente real (baseado em `../2.jpg`)
- `story-2.jpg` - Como aplicar (baseado em `../3.jpg`) 
- `story-3.jpg` - Dermato (baseado em `../4.jpg`)
- `story-4.jpg` - 30 dias depois (baseado em `../5.jpg`)
- `story-5.jpg` - UGC 1 (baseado em `../6.jpg`)
- `story-6.jpg` - UGC 2 (baseado em `../7.jpg`)

## Otimizações Aplicadas
- Tamanho: 80x80px (ideal para círculos)
- Formato: JPEG com qualidade 85%
- Compressão otimizada para web
- Carregamento rápido em conexões lentas

## Como Gerar os Thumbnails

### Usando ImageMagick (recomendado)
```bash
# Para imagens
magick input.jpg -resize 80x80^ -gravity center -crop 80x80+0+0 output.jpg

# Para vídeos (primeiro frame)
ffmpeg -i input.mp4 -vf "scale=80:80:force_original_aspect_ratio=increase,crop=80:80" -frames:v 1 output.jpg
```

### Usando FFmpeg para vídeos
```bash
# Extrair thumbnail do meio do vídeo
ffmpeg -i input.mp4 -ss 00:00:02 -vf "scale=80:80:force_original_aspect_ratio=increase,crop=80:80" -frames:v 1 output.jpg
```

## Integração com JavaScript
Os thumbnails são carregados automaticamente pelo sistema de detecção de dispositivo:
- Mobile: Carrega thumbnails primeiro, depois mídia completa
- Desktop: Pode carregar mídia completa diretamente se conexão for boa
