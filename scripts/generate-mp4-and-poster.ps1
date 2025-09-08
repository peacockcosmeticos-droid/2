param(
  [Parameter(Mandatory=$true)][string]$InPath,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [string]$Name = $(Split-Path -LeafBase $InPath),
  [ValidateSet('540x960','720x1280')][string]$Resolution = '540x960',
  [int]$Fps = 30,
  [int]$AudioKbps = 64,
  [int]$CRF = 23
)

# Requisitos: ffmpeg e ffprobe no PATH
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Error 'ffmpeg não encontrado no PATH'; exit 1 }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { Write-Error 'ffprobe não encontrado no PATH'; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$base = Join-Path $OutDir $Name
$outMp4 = "$base.mp4"
$poster = "$base-poster.jpg"

# Detectar se há áudio
$audioInfo = & ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$InPath"
$hasAudio = ($audioInfo -and ($audioInfo | Out-String).Trim().Length -gt 0)

# Filtros de escala preservando 9:16 e evitando upscale forte
$scale = if ($Resolution -eq '720x1280') { 'scale=w=720:h=1280:force_original_aspect_ratio=decrease' } else { 'scale=w=540:h=960:force_original_aspect_ratio=decrease' }
$pad = if ($Resolution -eq '720x1280') { 'pad=720:1280:(ow-iw)/2:(oh-ih)/2:black' } else { 'pad=540:960:(ow-iw)/2:(oh-ih)/2:black' }
$vf = "$scale,$pad,format=yuv420p"

# Construir comando ffmpeg para MP4 otimizado para web
$cmd = @('ffmpeg','-y','-i', $InPath,
  '-r', $Fps,
  '-vf', $vf,
  '-c:v','libx264','-profile:v','high','-preset','veryfast','-crf', $CRF,
  '-movflags','+faststart','-pix_fmt','yuv420p')

if ($hasAudio) { $cmd += @('-c:a','aac','-b:a',"$AudioKbps`k",'-ac','2') } else { $cmd += @('-an') }
$cmd += @($outMp4)

Write-Host "→ Gerando MP4 otimizado: $outMp4"
& $cmd[0] @($cmd[1..($cmd.Count-1)]) | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'Falha ao gerar MP4'; exit 1 }

# Poster (frame ~0.5s) com qualidade boa porém leve
Write-Host "→ Extraindo poster: $poster"
& ffmpeg -y -ss 0.5 -i "$InPath" -frames:v 1 -vf $vf -q:v 4 -update 1 "$poster" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Warning 'Falha ao extrair poster'; }

Write-Host "✅ Concluído:\n  MP4:    $outMp4\n  Poster: $poster"

