param([string]$targetPath, [string]$workDir)

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "DynamicIsland.lnk"

if (-not $targetPath) {
    $targetPath = "D:\Dynamic\run-background.vbs"
}
if (-not $workDir) {
    $workDir = "D:\Dynamic"
}

try {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetPath
    $shortcut.WorkingDirectory = $workDir
    $shortcut.Description = "Windows Dynamic Island"
    $shortcut.Save()
    Write-Output "SHORTCUT_CREATED:$shortcutPath"
} catch {
    Write-Output "ERR:$($_.Exception.Message)"
}
