# Build Script for Dynamic Island Native Controller (MediaCtrl.exe)
# No external dependencies needed - uses Windows built-in C# compiler.

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$srcFile = Join-Path $rootDir "src\MediaCtrl.cs"
$outFile = Join-Path $rootDir "src\MediaCtrl.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Dynamic Island Native Controller" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Source: $srcFile"
Write-Host "Target: $outFile"

# Locate C# Compiler
$cscPaths = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$cscExe = $null
foreach ($path in $cscPaths) {
    if (Test-Path $path) {
        $cscExe = $path
        break
    }
}

if (-not $cscExe) {
    $whereCsc = where.exe csc 2>$null
    if ($whereCsc) {
        $cscExe = $whereCsc[0]
    }
}

if (-not $cscExe) {
    Write-Error "Could not find csc.exe. Please ensure .NET Framework 4.0+ is enabled on Windows."
    exit 1
}

Write-Host "Using compiler: $cscExe" -ForegroundColor Green

# Compile with optimization
$proc = Start-Process -FilePath $cscExe -ArgumentList "/target:exe", "/optimize+", "/out:`"$outFile`"", "`"$srcFile`"", "/r:System.Management.dll" -NoNewWindow -Wait -PassThru

if ($proc.ExitCode -eq 0) {
    $fileInfo = Get-Item $outFile
    Write-Host "SUCCESS: MediaCtrl.exe built successfully! Size: $($fileInfo.Length) bytes" -ForegroundColor Green
    exit 0
} else {
    Write-Error "Compilation failed with exit code $($proc.ExitCode)"
    exit $proc.ExitCode
}
