[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null

    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }[0]
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
        $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $playback = $session.GetPlaybackInfo()
        $timeline = $session.GetTimelineProperties()
        $status = if ($playback) { $playback.PlaybackStatus.ToString() } else { "Unknown" }
        $rate = if ($playback -and $playback.PlaybackRate) { [double]$playback.PlaybackRate } else { 1.0 }

        $pos = if ($timeline) { [double]$timeline.Position.TotalSeconds } else { 0.0 }
        $endTime = if ($timeline) { [double]$timeline.EndTime.TotalSeconds } else { 0.0 }

        if ($timeline -and $status -eq "Playing" -and $timeline.LastUpdatedTime) {
            $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime.ToUniversalTime()).TotalSeconds
            if ($elapsed -gt 0) {
                $pos = $pos + ($elapsed * $rate)
                if ($endTime -gt 0 -and $pos -gt $endTime) {
                    $pos = $endTime
                }
            }
        }

        $thumbnailBase64 = ""
        if ($props.Thumbnail) {
            try {
                $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                $asStreamMethod = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStream', [Type[]]@([Windows.Storage.Streams.IRandomAccessStream]))
                if ($asStreamMethod) {
                    $netStream = $asStreamMethod.Invoke($null, @($stream))
                    $mem = New-Object System.IO.MemoryStream
                    $netStream.CopyTo($mem)
                    $bytes = $mem.ToArray()
                    $netStream.Dispose()
                    $mem.Dispose()
                    $thumbnailBase64 = [Convert]::ToBase64String($bytes)
                }
            } catch {
                # ignore thumbnail read error
            }
        }

        $res = @{
            title = $props.Title
            artist = $props.Artist
            albumTitle = $props.AlbumTitle
            albumArtist = $props.AlbumArtist
            status = $status
            sourceApp = $session.SourceAppUserModelId
            thumbnail = $thumbnailBase64
            position = [Math]::Round($pos, 1)
            endTime = [Math]::Round($endTime, 1)
        }
        $res | ConvertTo-Json -Compress
    } else {
        Write-Output "{}"
    }
} catch {
    Write-Output "{}"
}
