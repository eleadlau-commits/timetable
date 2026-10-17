param([Parameter(Mandatory=$true)][string]$ImagePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$taskAdapter = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-Local($Operation, [Type]$ResultType) {
  $task = $taskAdapter.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
$outputPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'credentials\private-ocr-result.json'
$file = Await-Local ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path -LiteralPath $ImagePath).Path)) ([Windows.Storage.StorageFile])
$stream = Await-Local ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
try {
  $decoder = Await-Local ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if ($null -eq $engine) { throw 'Local OCR language unavailable.' }
  $results = @()
  foreach ($rotation in @('None', 'Clockwise90Degrees', 'Clockwise180Degrees', 'Clockwise270Degrees')) {
    $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
    $transform.Rotation = [Windows.Graphics.Imaging.BitmapRotation]::$rotation
    $bitmap = Await-Local ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore, $transform, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
      $ocr = Await-Local ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      $results += @{ rotation = $rotation; lines = @($ocr.Lines | ForEach-Object { $_.Text }) }
    } finally { $bitmap.Dispose() }
  }
  # Sensitive OCR output stays in the ignored credentials directory, never stdout.
  [System.IO.File]::WriteAllText($outputPath, (ConvertTo-Json -InputObject $results -Depth 5))
  Write-Output 'Local OCR completed; private result written inside credentials only.'
} finally { $stream.Dispose() }
