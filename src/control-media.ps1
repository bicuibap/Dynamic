param([string]$action, [string]$value)

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }[0]
    function Await($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }
    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
    $manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    $session = $manager.GetCurrentSession()

    if ($session) {
        switch ($action) {
            "play-pause" { $null = Await ($session.TryTogglePlayPauseAsync()) ([System.Boolean]) }
            "play" { $null = Await ($session.TryPlayAsync()) ([System.Boolean]) }
            "pause" { $null = Await ($session.TryPauseAsync()) ([System.Boolean]) }
            "next" { $null = Await ($session.TrySkipNextAsync()) ([System.Boolean]) }
            "prev" { $null = Await ($session.TrySkipPreviousAsync()) ([System.Boolean]) }
            "seek" {
                $seconds = [double]$value
                $ticks = [long]($seconds * 10000000)
                $null = Await ($session.TryChangePlaybackPositionAsync($ticks)) ([System.Boolean])
            }
        }
        Write-Output "OK_WINRT"
    } else {
        # Fallback to keybd_event
        $code = '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);'
        Add-Type -MemberDefinition $code -Name Win32Keybd -Namespace Win32Functions
        $vKey = switch ($action) {
            "play-pause" { 0xB3 }
            "next" { 0xB0 }
            "prev" { 0xB1 }
            default { 0 }
        }
        if ($vKey -ne 0) {
            [Win32Functions.Win32Keybd]::keybd_event($vKey, 0, 0, 0)
            [Win32Functions.Win32Keybd]::keybd_event($vKey, 0, 2, 0)
        }
        Write-Output "OK_FALLBACK"
    }
} catch {
    # Fallback to keybd_event on error
    $code = '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);'
    Add-Type -MemberDefinition $code -Name Win32Keybd -Namespace Win32Functions
    $vKey = switch ($action) {
        "play-pause" { 0xB3 }
        "next" { 0xB0 }
        "prev" { 0xB1 }
        default { 0 }
    }
    if ($vKey -ne 0) {
        [Win32Functions.Win32Keybd]::keybd_event($vKey, 0, 0, 0)
        [Win32Functions.Win32Keybd]::keybd_event($vKey, 0, 2, 0)
    }
    Write-Output "OK_FALLBACK_CATCH"
}
