param([Parameter(Mandatory=$true)][string]$ManifestPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$careSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $careSpeaker.SelectVoice('Microsoft Hanhan Desktop')
  $careSpeaker.Rate = -1
  $careChapters = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($careChapter in $careChapters) {
    $careSpeaker.SetOutputToWaveFile($careChapter.audioPath)
    $careSpeaker.Speak($careChapter.narration)
  }
} finally { $careSpeaker.Dispose() }
