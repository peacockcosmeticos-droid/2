# Vídeos Mobile Otimizados

Esta pasta contém versões otimizadas para dispositivos móveis de todos os vídeos dos Stories.

## Especificações Mobile
- **Resolução máxima**: 720p (1280x720)
- **Bitrate**: 1-2 Mbps (vs 4-8 Mbps desktop)
- **Codec**: H.264 (compatibilidade máxima)
- **Áudio**: AAC 128kbps
- **Objetivo**: Streaming suave em conexões móveis

## Estrutura de Nomenclatura
- `1.mp4` - Cliente real (mobile)
- `2.mp4` - Cliente real (mobile)  
- `3.mp4` - Como aplicar (mobile)
- `6.mp4` - 30 dias depois (mobile)

## Como Gerar Versões Mobile

### Comando FFmpeg Recomendado
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

### Parâmetros Explicados
- `-vf "scale=..."`: Redimensiona para 720p mantendo proporção
- `-c:v libx264`: Codec de vídeo H.264
- `-preset medium`: Balanço velocidade/qualidade
- `-crf 23`: Qualidade constante (18-28, menor = melhor)
- `-c:a aac -b:a 128k`: Áudio AAC 128kbps
- `-movflags +faststart`: Otimiza para streaming web

### Versão Ultra-Compacta (para 3G)
```bash
ffmpeg -i input.mp4 \
  -vf "scale=854:480:force_original_aspect_ratio=decrease" \
  -c:v libx264 -preset fast -crf 28 \
  -c:a aac -b:a 96k \
  -r 24 \
  output.mp4
```

### Batch Processing
```bash
# Processar todos os vídeos
for file in *.mp4; do
    ffmpeg -i "$file" \
      -vf "scale=1280:720:force_original_aspect_ratio=decrease" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      "mobile/$file"
done
```

## Benefícios
- 📱 **60-80% menor** que versões desktop
- ⚡ **Carregamento rápido** em 4G
- 🌐 **Compatível** com conexões 3G
- 🔋 **Economia de bateria** no dispositivo
- 💾 **Menor uso de dados** para usuários
