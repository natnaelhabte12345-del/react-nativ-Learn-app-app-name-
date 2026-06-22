param(
  [string]$Port = "8081",
  [string]$AppId = "com.anonymous.dualingoclone",
  [string]$AvdName = $env:ANDROID_AVD_NAME
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot "android"
$gradle = Join-Path $androidDir "gradlew.bat"
$apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$logsDir = Join-Path $repoRoot ".expo-logs"

function Get-RunningEmulatorSerial {
  $runningEmulators = adb devices | Select-String -Pattern "^emulator-\d+\s+device"

  if ($env:ANDROID_EMULATOR_SERIAL) {
    $matchingSerial = $runningEmulators | Where-Object {
      (($_.ToString() -split "\s+")[0]) -eq $env:ANDROID_EMULATOR_SERIAL
    } | Select-Object -First 1

    if ($matchingSerial) {
      return $env:ANDROID_EMULATOR_SERIAL
    }

    throw "ANDROID_EMULATOR_SERIAL is set to '$env:ANDROID_EMULATOR_SERIAL', but that emulator is not running."
  }

  if ($runningEmulators) {
    return (($runningEmulators | Select-Object -First 1).ToString() -split "\s+")[0]
  }

  return $null
}

function Start-AndroidEmulatorIfNeeded {
  $serial = Get-RunningEmulatorSerial
  if ($serial) {
    return $serial
  }

  $emulatorCommand = Get-Command emulator -ErrorAction SilentlyContinue
  if (-not $emulatorCommand) {
    throw "Android emulator command was not found. Add Android SDK emulator tools to PATH or start an emulator from Android Studio."
  }

  $availableAvds = emulator -list-avds
  if (-not $availableAvds) {
    throw "No Android Virtual Devices found. Create an emulator in Android Studio first."
  }

  $targetAvd = if ($AvdName) { $AvdName } else { ($availableAvds | Select-Object -First 1) }
  if ($availableAvds -notcontains $targetAvd) {
    throw "AVD '$targetAvd' was not found. Available AVDs: $($availableAvds -join ', ')"
  }

  Write-Host "Starting Android emulator: $targetAvd"
  Start-Process -FilePath $emulatorCommand.Source -ArgumentList @("-avd", $targetAvd)

  $deadline = (Get-Date).AddSeconds(120)
  do {
    Start-Sleep -Seconds 2
    $serial = Get-RunningEmulatorSerial
  } while (-not $serial -and (Get-Date) -lt $deadline)

  if (-not $serial) {
    throw "Timed out waiting for Android emulator '$targetAvd' to appear in adb devices."
  }

  Write-Host "Waiting for emulator boot: $serial"
  $bootDeadline = (Get-Date).AddSeconds(180)
  do {
    Start-Sleep -Seconds 2
    $bootCompleted = adb -s $serial shell getprop sys.boot_completed 2>$null
  } while ($bootCompleted -ne "1" -and (Get-Date) -lt $bootDeadline)

  if ($bootCompleted -ne "1") {
    throw "Timed out waiting for Android emulator '$targetAvd' to finish booting."
  }

  return $serial
}

function Start-MetroIfNeeded {
  $metro = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($metro) {
    return
  }

  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

  $stdoutLog = Join-Path $logsDir "metro-android-emulator.out.log"
  $stderrLog = Join-Path $logsDir "metro-android-emulator.err.log"

  Write-Host "Starting Metro on localhost:$Port"
  Start-Process `
    -FilePath "npx.cmd" `
    -ArgumentList @("expo", "start", "--localhost", "--dev-client", "--port", $Port) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(60)
  do {
    Start-Sleep -Seconds 1
    $metro = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  } while (-not $metro -and (Get-Date) -lt $deadline)

  if (-not $metro) {
    throw "Timed out waiting for Metro on port $Port. Check logs: $stdoutLog and $stderrLog"
  }
}

$serial = Start-AndroidEmulatorIfNeeded

Write-Host "Using Android emulator: $serial"

Start-MetroIfNeeded

if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "development"
}

Write-Host "Building debug APK..."

Push-Location $androidDir
try {
  & $gradle app:assembleDebug -x lint -x test --configure-on-demand --build-cache "-PreactNativeDevServerPort=$Port"
} finally {
  Pop-Location
}

if (-not (Test-Path $apk)) {
  throw "Debug APK was not found at $apk"
}

Write-Host "Forwarding emulator port $Port to local Metro..."
adb -s $serial reverse "tcp:$Port" "tcp:$Port"

Write-Host "Installing APK on $serial..."
adb -s $serial install -r -d --user 0 $apk

Write-Host "Launching $AppId on $serial..."
adb -s $serial shell monkey -p $AppId 1

Write-Host "Done. Metro logs: $logsDir"
