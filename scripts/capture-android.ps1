param([ValidatePattern('^[a-zA-Z0-9-]+$')][string]$Name = 'capture')
$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot '../release/graphics/screenshots-android'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$path = Join-Path $outDir ($Name + '.png')
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = 'adb'
$info.Arguments = 'exec-out screencap -p'
$info.UseShellExecute = $false
$info.RedirectStandardOutput = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $info
$null = $proc.Start()
$file = [IO.File]::Open($path, [IO.FileMode]::Create)
try { $proc.StandardOutput.BaseStream.CopyTo($file) } finally { $file.Dispose() }
$proc.WaitForExit()
if ($proc.ExitCode -ne 0) { throw 'ADB a échoué : vérifier le téléphone et le débogage USB.' }
Write-Host "Capture enregistrée : $path"
