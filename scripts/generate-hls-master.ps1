Param(
  [Parameter(Mandatory=$true)] [string]$InPath,
  [Parameter(Mandatory=$true)] [string]$OutDir,
  [Parameter(Mandatory=$true)] [string]$Name
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail($msg){ Write-Error $msg; exit 1 }

if (!(Test-Path $InPath)) { Fail "Arquivo de entrada não encontrado: $InPath" }
$ff = (Get-Command ffmpeg -ErrorAction SilentlyContinue)
if (!$ff) { Fail "ffmpeg não encontrado no PATH. Instale o FFmpeg e tente novamente." }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$master = Join-Path $OutDir ("{0}_master.m3u8" -f $Name)
$segTpl = Join-Path $OutDir ("{0}_%v_%03d.ts" -f $Name)

Write-Host ("Gerando HLS (master): {0}" -f $master)

# Ladder móvel: 240p (baixo), 360p (médio), 480p (alto)
# CRF + maxrate/bufsize (constrained CRF) p/ qualidade estável e controle de pico
# GOP ~ 2s (48 @ 24/30 fps) p/ melhor seek

# Detecta se o vídeo possui faixa de áudio
$audioInfo = & ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$InPath" 2>$null
$hasAudio = ($audioInfo -and ($audioInfo | Out-String).Trim().Length -gt 0)

$cmd = @('ffmpeg','-y','-i', $InPath,
  '-filter_complex','[0:v]split=3[v1][v2][v3]; [v1]scale=-2:240:flags=lanczos[v1o]; [v2]scale=-2:360:flags=lanczos[v2o]; [v3]scale=-2:480:flags=lanczos[v3o]')

# 240p
$cmd += @('-map','[v1o]','-c:v:0','h264','-profile:v:0','main','-preset','veryfast','-crf:0','23','-maxrate:0','350k','-bufsize:0','700k')
if ($hasAudio) { $cmd += @('-map','a:0?','-c:a:0','aac','-b:a:0','80k','-ac:0','2') }

# 360p
$cmd += @('-map','[v2o]','-c:v:1','h264','-profile:v:1','main','-preset','veryfast','-crf:1','22','-maxrate:1','700k','-bufsize:1','1400k')
if ($hasAudio) { $cmd += @('-map','a:0?','-c:a:1','aac','-b:a:1','96k','-ac:1','2') }

# 480p
$cmd += @('-map','[v3o]','-c:v:2','h264','-profile:v:2','main','-preset','veryfast','-crf:2','21','-maxrate:2','1100k','-bufsize:2','2200k')
if ($hasAudio) { $cmd += @('-map','a:0?','-c:a:2','aac','-b:a:2','96k','-ac:2','2') }

# GOP/segmentação
$cmd += @('-g','48','-keyint_min','48','-sc_threshold','0','-pix_fmt','yuv420p',
  '-hls_time','4','-hls_playlist_type','vod','-hls_flags','independent_segments',
  '-master_pl_name', ("{0}_master.m3u8" -f $Name))

$varMap = if ($hasAudio) { 'v:0,a:0 v:1,a:1 v:2,a:2' } else { 'v:0 v:1 v:2' }
$cmd += @('-var_stream_map', $varMap,
  '-hls_segment_filename', $segTpl,
  (Join-Path $OutDir ("{0}_%v.m3u8" -f $Name)))

$exe = $cmd[0]
$ffArgs = $cmd[1..($cmd.Length-1)]
& $exe @ffArgs
if ($LASTEXITCODE -ne 0) { Fail "Falha ao gerar HLS master" }

Write-Host ("OK. Arquivos gerados em: {0}" -f $OutDir)
Write-Host ("Aponte no código para: ./videos/hls/mobile/{0}_master.m3u8" -f $Name)

