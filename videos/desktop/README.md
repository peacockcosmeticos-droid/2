# Vídeos Desktop Alta Qualidade

Esta pasta contém versões de alta qualidade para dispositivos desktop de todos os vídeos dos Stories.

## Especificações Desktop
- **Resolução**: 1080p ou superior (1920x1080+)
- **Bitrate**: 4-8 Mbps (alta qualidade)
- **Codec**: H.264 High Profile
- **Áudio**: AAC 192-256kbps
- **Objetivo**: Máxima qualidade visual para telas grandes

## Estrutura de Nomenclatura
- `1.mp4` - Cliente real (desktop)
- `2.mp4` - Cliente real (desktop)
- `3.mp4` - Como aplicar (desktop)
- `6.mp4` - 30 dias depois (desktop)

## Como Gerar Versões Desktop

### Comando FFmpeg Recomendado
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -profile:v high -preset slow -crf 18 \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

### Parâmetros Explicados
- `-vf "scale=..."`: Redimensiona para 1080p mantendo proporção
- `-c:v libx264 -profile:v high`: Codec H.264 perfil alto
- `-preset slow`: Máxima qualidade (mais lento)
- `-crf 18`: Qualidade muito alta (18 = quase lossless)
- `-c:a aac -b:a 192k`: Áudio AAC 192kbps
- `-movflags +faststart`: Otimiza para streaming web

### Versão 4K (para displays premium)
```bash
ffmpeg -i input.mp4 \
  -vf "scale=3840:2160:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -preset slow -crf 20 \
  -c:a aac -b:a 256k \
  -movflags +faststart \
  output.mp4
```

### Otimização para Web
```bash
# Versão otimizada para streaming web desktop
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
  -c:v libx264 -profile:v high -preset medium -crf 20 \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  -pix_fmt yuv420p \
  output.mp4
```

### Batch Processing
```bash
# Processar todos os vídeos para desktop
for file in *.mp4; do
    ffmpeg -i "$file" \
      -vf "scale=1920:1080:force_original_aspect_ratio=decrease" \
      -c:v libx264 -profile:v high -preset medium -crf 20 \
      -c:a aac -b:a 192k \
      -movflags +faststart \
      "desktop/$file"
done
```

## Quando Usar
- 🖥️ **Telas grandes** (>1024px)
- ⚡ **Conexões rápidas** (WiFi, fibra)
- 🎯 **Experiência premium** para desktop
- 📊 **Apresentações** profissionais

## Benefícios
- 🎨 **Máxima qualidade visual**
- 🎬 **Detalhes preservados** em telas grandes
- ⚡ **Streaming suave** em conexões rápidas
- 🎯 **Experiência cinematográfica** para usuários desktop
