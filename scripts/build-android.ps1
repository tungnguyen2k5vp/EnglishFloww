param([string]$JavaHome = $env:JAVA_HOME, [string]$AndroidHome = $env:ANDROID_HOME)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $JavaHome -and (Test-Path 'C:/Program Files/Java/jdk-19/bin/java.exe')) { $JavaHome = 'C:/Program Files/Java/jdk-19' }
if (-not $JavaHome) { throw 'Set JAVA_HOME to a JDK 17-22 installation (Gradle 8.9).' }
$javaRelease = Join-Path $JavaHome 'release'
if (-not (Test-Path $javaRelease)) { throw 'JAVA_HOME must point to a full JDK installation.' }
$javaMajor = [int]([regex]::Match((Get-Content -Raw $javaRelease), 'JAVA_VERSION="(\d+)').Groups[1].Value)
if ($javaMajor -lt 17 -or $javaMajor -gt 22) { throw 'Gradle 8.9 requires JDK 17-22. Pass -JavaHome or set JAVA_HOME to a supported JDK.' }
if (-not $AndroidHome) { $AndroidHome = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
if (-not (Test-Path (Join-Path $AndroidHome 'platforms/android-36/android.jar'))) { throw 'Install Android SDK platform 36 and set ANDROID_HOME.' }
$previousJava = $env:JAVA_HOME
$previousAndroid = $env:ANDROID_HOME
$assessmentPath = Join-Path $projectRoot 'android/app/src/main/assets/assessment'
if (-not (Test-Path (Join-Path $assessmentPath 'phonemes.onnx'))) { throw 'Run python scripts/prepare-assessment.py before building the Android phoneme scorer.' }
$assessmentSource = Get-Content -Raw -Encoding UTF8 (Join-Path $assessmentPath 'sources.json') | ConvertFrom-Json
if ((Get-FileHash -Algorithm SHA256 (Join-Path $assessmentPath 'phonemes.onnx')).Hash.ToLowerInvariant() -ne $assessmentSource.sha256) { throw 'The acoustic model hash differs from its pinned source. Run scripts/prepare-assessment.py again.' }
Push-Location $projectRoot
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $AndroidHome
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web assets build failed.' }
    & ./android/gradlew.bat -p android assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    New-Item -ItemType Directory -Force releases | Out-Null
    $appVersion = (Get-Content -Raw -Encoding UTF8 package.json | ConvertFrom-Json).version
    $apkDestination = "releases/EnglishFlow-Android-$appVersion.apk"
    Copy-Item -LiteralPath android/app/build/outputs/apk/debug/app-debug.apk -Destination $apkDestination
    Get-FileHash -Algorithm SHA256 $apkDestination
} finally {
    Pop-Location
    $env:JAVA_HOME = $previousJava
    $env:ANDROID_HOME = $previousAndroid
}
