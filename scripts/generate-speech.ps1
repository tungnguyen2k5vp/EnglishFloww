$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'public/media'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$lessons = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'media-script.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SelectVoice('Microsoft Zira Desktop')
  $synth.Rate = -1
  $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  foreach ($lesson in $lessons) {
    $pcm = New-Object System.IO.MemoryStream
    foreach ($segment in $lesson.segments) {
      $stream = New-Object System.IO.MemoryStream
      $synth.SetOutputToWaveStream($stream)
      $synth.Speak($segment.en)
      $synth.SetOutputToNull()
      $raw = $stream.ToArray()
      $stream.Dispose()
      $offset = 12
      $audio = $null
      while ($offset + 8 -le $raw.Length) {
        $chunk = [System.Text.Encoding]::ASCII.GetString($raw, $offset, 4)
        $size = [BitConverter]::ToInt32($raw, $offset + 4)
        if ($chunk -eq 'fmt ') {
          $sampleRate = [BitConverter]::ToInt32($raw, $offset + 12)
          $byteRate = [BitConverter]::ToInt32($raw, $offset + 16)
          $channels = [BitConverter]::ToInt16($raw, $offset + 10)
          $bits = [BitConverter]::ToInt16($raw, $offset + 22)
        }
        if ($chunk -eq 'data') { $audio = New-Object byte[] $size; [Array]::Copy($raw, $offset + 8, $audio, 0, $size); break }
        $offset += 8 + $size + ($size % 2)
      }
      if ($null -eq $audio) { throw 'No PCM data in speech output' }
      $targetBytes = [int](($segment.end - $segment.start) * $byteRate)
      if ($audio.Length -gt $targetBytes) { throw "Speech exceeds caption interval: $($segment.en)" }
      $pcm.Write($audio, 0, $audio.Length)
      $silence = New-Object byte[] ($targetBytes - $audio.Length)
      $pcm.Write($silence, 0, $silence.Length)
    }
    $file = [IO.File]::Create((Join-Path $out ($lesson.name + '.wav')))
    $writer = New-Object IO.BinaryWriter($file)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF')); $writer.Write([int](36 + $pcm.Length)); $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
    $writer.Write([int]16); $writer.Write([int16]1); $writer.Write([int16]$channels); $writer.Write([int]$sampleRate); $writer.Write([int]$byteRate); $writer.Write([int16]($channels * $bits / 8)); $writer.Write([int16]$bits)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('data')); $writer.Write([int]$pcm.Length); $writer.Write($pcm.ToArray()); $writer.Dispose(); $pcm.Dispose()
    Write-Output "Generated $($lesson.name).wav"
  }
} finally { $synth.Dispose() }
