# Thumbnails de Vídeos para Círculos dos Stories

Esta pasta contém frames extraídos dos vídeos (80x80px) para exibir nos círculos dos avatares.

## Estrutura de Nomenclatura

### Vídeos dos Stories
- `video-1.jpg` - Frame do `../1.mp4` (Cliente real)
- `video-2.jpg` - Frame do `../2.mp4` (Cliente real)
- `video-3.jpg` - Frame do `../3.mp4` (Como aplicar)
- `video-6.jpg` - Frame do `../6.mp4` (30 dias depois)

## Especificações Técnicas
- **Tamanho**: 80x80px (quadrado)
- **Formato**: JPEG otimizado
- **Qualidade**: 85% (balanço qualidade/tamanho)
- **Crop**: Center crop para manter proporção
- **Frame**: Extraído do segundo 2-3 do vídeo (momento mais representativo)

## Como Gerar os Thumbnails

### Comando FFmpeg Recomendado
```bash
# Extrair frame do segundo 2 do vídeo
ffmpeg -i input.mp4 -ss 00:00:02 -vf "scale=80:80:force_original_aspect_ratio=increase,crop=80:80" -frames:v 1 -q:v 2 output.jpg
```

### Parâmetros Explicados
- `-ss 00:00:02`: Pula para o segundo 2
- `-vf "scale=80:80:..."`: Redimensiona mantendo proporção e faz crop central
- `-frames:v 1`: Extrai apenas 1 frame
- `-q:v 2`: Qualidade alta (1-31, menor = melhor)

### Batch Processing
```bash
# Para processar todos os vídeos de uma vez
for file in *.mp4; do
    ffmpeg -i "$file" -ss 00:00:02 -vf "scale=80:80:force_original_aspect_ratio=increase,crop=80:80" -frames:v 1 -q:v 2 "thumbnails/${file%.*}.jpg"
done
```

## Integração com Preview de Vídeo
Estes thumbnails são usados como:
1. **Placeholder inicial** enquanto o vídeo carrega
2. **Preview estático** em conexões muito lentas  
3. **Fallback** se o vídeo falhar ao carregar
4. **Base para animação** de preview nos círculos
