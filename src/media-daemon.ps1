[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
    [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null

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

    $lastTitle = ""
    $lastStatus = ""
    $lastPos = -1

    while ($true) {
        $session = $manager.GetCurrentSession()
        if ($session) {
            try {
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

                $title = if ($props.Title) { $props.Title } else { "" }
                $artist = if ($props.Artist) { $props.Artist } else { "" }

                $thumbnailBase64 = ""
                if ($title -ne $lastTitle -and $props.Thumbnail) {
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
                    } catch {}
                }

                $res = @{
                    title = $title
                    artist = $artist
                    albumTitle = if ($props.AlbumTitle) { $props.AlbumTitle } else { "" }
                    status = $status
                    sourceApp = $session.SourceAppUserModelId
                    position = [Math]::Round($pos, 1)
                    endTime = [Math]::Round($endTime, 1)
                }

                if ($thumbnailBase64.Length -gt 0) {
                    $res["thumbnail"] = $thumbnailBase64
                }

                $json = ($res | ConvertTo-Json -Compress)
                [Console]::Out.WriteLine("MEDIA_DATA:" + $json)
                [Console]::Out.Flush()

                $lastTitle = $title
                $lastStatus = $status
                $lastPos = $pos
            } catch {
                [Console]::Out.WriteLine("MEDIA_DATA:{}")
                [Console]::Out.Flush()
            }
        } else {
            if ($lastTitle -ne "") {
                [Console]::Out.WriteLine("MEDIA_DATA:{}")
                [Console]::Out.Flush()
                $lastTitle = ""
            }
        }

        [System.Threading.Thread]::Sleep(700)
    }
} catch {
    [Console]::Out.WriteLine("DAEMON_ERROR:" + $_.Exception.Message)
    [Console]::Out.Flush()
}
