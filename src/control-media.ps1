param([string]$action, [string]$value)

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    }[0]

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
                $res = Await ($session.TryChangePlaybackPositionAsync($ticks)) ([System.Boolean])
                $controls = $session.GetPlaybackInfo().Controls
                Write-Output "SEEK_RESULT:$res|IS_SEEK_ENABLED:$($controls.IsPlaybackPositionChangeEnabled)"
                return
            }
        }
        Write-Output "OK_WINRT"
    } else {
        Write-Output "NO_SESSION"
    }
} catch {
    Write-Output "ERR"
}
