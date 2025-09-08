<#!
Gera assets HLS (m3u8 + .ts) para mobile a partir dos MP4 otimizados.
Requisitos:
  - ffmpeg disponível no PATH (https://ffmpeg.org/)

Uso (PowerShell):
  pwsh -File scripts/generate-hls.ps1 -Input "videos/mobile/brenda_optimized.mp4" -OutDir "videos/hls/mobile" -Name "brenda"

Observações:
  - Este script gera 1 variante (360p) focada em mobile, com segmentos de ~4s.
  - Mantemos os MP4s como fallback no site; este HLS será usado automaticamente no mobile.
  - Se quiser múltiplas qualidades (240p/360p) e master.m3u8, me avise que eu amplio o script.
!#>
param(
  [Parameter(Mandatory=$true)]
  [string]$InPath,
  [Parameter(Mandatory=$true)]
  [string]$OutDir,
  [Parameter(Mandatory=$true)]
  [string]$Name
)

function Fail($msg){ Write-Error $msg; exit 1 }

# Checagens básicas
if (!(Test-Path $InPath)) { Fail "Arquivo de entrada não encontrado: $InPath" }
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue)
if (!$ff) { Fail "ffmpeg não encontrado no PATH. Instale o FFmpeg e tente novamente." }

# Criar pasta de saída
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Fast start sugerido previamente; se necessário, gere antes seus MP4 com +faststart
# Exemplo (opcional): ffmpeg -i IN.mp4 -movflags +faststart -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 96k OUT_faststart.mp4

$base = Join-Path $OutDir $Name
$playlist = "$base`_360p.m3u8"
$segments = "$base`_360p_%03d.ts"

# Gerar HLS mobile (360p)
$ffArgs = @(
  '-y',
  '-i', $InPath,
  '-vf', 'scale=-2:360',
  '-c:v', 'h264',
  '-profile:v', 'main',
  '-preset', 'veryfast',
  '-crf', '23',
  '-g', '48',
  '-keyint_min', '48',
  '-sc_threshold', '0',
  '-c:a', 'aac',
  '-b:a', '96k',
  '-hls_time', '4',
  '-hls_playlist_type', 'vod',
  '-hls_segment_filename', $segments,
  $playlist
)

Write-Host "Gerando HLS: $playlist"
& ffmpeg @ffArgs
if ($LASTEXITCODE -ne 0) { Fail "Falha ao gerar HLS" }

Write-Host "OK. Arquivos gerados em: $OutDir"
Write-Host "Apontei no código para: ./videos/hls/mobile/${Name}_360p.m3u8"

