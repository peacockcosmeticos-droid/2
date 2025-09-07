# Versões Desktop Alta Qualidade

Esta pasta contém versões de alta qualidade para dispositivos desktop de todas as imagens dos Stories.

## Especificações Desktop
- **Resolução**: Original ou até 1920px
- **Qualidade**: 90-95% (máxima qualidade visual)
- **Formato**: JPEG de alta qualidade
- **Objetivo**: Melhor experiência visual em telas grandes

## Estrutura de Nomenclatura

### Imagens Antes/Depois
- `antesedepois-1.jpg` até `antesedepois-11.jpg`
- Versões alta qualidade das imagens originais

### Imagens dos Stories
- `story-1.jpg` - Cliente real (desktop)
- `story-2.jpg` - Como aplicar (desktop)
- `story-3.jpg` - Dermato (desktop)
- `story-4.jpg` - 30 dias depois (desktop)
- `story-5.jpg` - UGC 1 (desktop)
- `story-6.jpg` - UGC 2 (desktop)

## Como Gerar Versões Desktop

### Usando ImageMagick
```bash
# Manter resolução original, apenas otimizar qualidade
magick input.jpg -quality 95 -strip output.jpg

# Ou redimensionar para máximo 1920px se necessário
magick input.jpg -resize 1920x1920> -quality 95 -strip output.jpg
```

### Otimizações Aplicadas
- **Strip metadata**: Remove dados EXIF desnecessários
- **Qualidade 95%**: Máxima qualidade visual
- **Preservar resolução**: Mantém tamanho original quando possível
- **Progressive JPEG**: Carregamento progressivo

### Batch Processing
```bash
# Processar todas as imagens mantendo alta qualidade
for file in *.jpg; do
    magick "$file" -quality 95 -strip "desktop/$file"
done
```

## Quando Usar
- 🖥️ **Telas grandes** (>1024px)
- ⚡ **Conexões rápidas** (4G, WiFi)
- 🎯 **Experiência premium** para desktop
- 📊 **Apresentações** e demonstrações

## Benefícios
- 🎨 **Máxima qualidade visual**
- 🖼️ **Detalhes preservados** em telas grandes
- ⚡ **Carregamento aceitável** em conexões rápidas
- 🎯 **Experiência premium** para usuários desktop
