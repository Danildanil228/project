param(
    [string]$TextureRoot = "C:\Users\danil\Desktop\rr4\allfilescopy\AssetRipper_export_20260610_230108\Assets\Texture2D",
    [string]$OutputRoot = "C:\Users\danil\Desktop\project\back\uploads\items",
    [int]$Size = 1800,
    [int]$JpegQuality = 90
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$maps = @(
    @{ Source = "map_level_001_lake.png"; Output = "rf4-map-komarino.jpg" },
    @{ Source = "map_level_002_kirzah.png"; Output = "rf4-map-vyunok.jpg" },
    @{ Source = "map_level_003_viiveri_lake.png"; Output = "rf4-map-kuori.jpg" },
    @{ Source = "map_level_004_torfyanoe.png"; Output = "rf4-map-old-fort.jpg" },
    @{ Source = "map_level_005_volhov.png"; Output = "rf4-map-volkhov.jpg" },
    @{ Source = "map_level_006_ladoga.png"; Output = "rf4-map-ladoga.jpg" },
    @{ Source = "map_level_007_grass_lake.png"; Output = "rf4-map-bear-lake.jpg" },
    @{ Source = "map_level_008_sura_river.png"; Output = "rf4-map-sura.jpg" },
    @{ Source = "map_level_009_ahtuba.png"; Output = "rf4-map-akhtuba.jpg" },
    @{ Source = "map_level_010_belaya.png"; Output = "rf4-map-belaya.jpg" },
    @{ Source = "map_level_011_ladoga_02.png"; Output = "rf4-map-ladoga-archipelago.jpg" },
    @{ Source = "map_level_012_north_sea.png"; Output = "rf4-map-norwegian-sea.jpg" },
    @{ Source = "map_level_013_sev_don.png"; Output = "rf4-map-seversky-donets.jpg" },
    @{ Source = "map_level_014_carp_lake.png"; Output = "rf4-map-amber-lake.jpg" },
    @{ Source = "map_level_015_tunguska.png"; Output = "rf4-map-lower-tunguska.jpg" },
    @{ Source = "map_level_016_yama.png"; Output = "rf4-map-yama.jpg" },
    @{ Source = "map_level_018_moskitnoe.png"; Output = "rf4-map-copper-lake.jpg" },
    @{ Source = "map_level_019_american_pond.png"; Output = "rf4-map-losinoe.jpg" }
)

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
$encoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new($encoder, [long]$JpegQuality)
$rows = [System.Collections.Generic.List[object]]::new()

try {
    foreach ($map in $maps) {
        $sourcePath = Join-Path $TextureRoot $map.Source
        $outputPath = Join-Path $OutputRoot $map.Output
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Map source not found: $sourcePath"
        }

        $source = [System.Drawing.Image]::FromFile($sourcePath)
        $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($source, 0, 0, $Size, $Size)
            $bitmap.Save($outputPath, $jpegCodec, $encoderParameters)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
            $source.Dispose()
        }

        $outputFile = Get-Item -LiteralPath $outputPath
        $rows.Add([PSCustomObject]@{
            Source = $map.Source
            Output = $map.Output
            Width = $Size
            Height = $Size
            Bytes = $outputFile.Length
        })
    }
} finally {
    $encoderParameters.Dispose()
}

$reportPath = Join-Path $OutputRoot "rf4-map-import.csv"
$rows | Export-Csv -LiteralPath $reportPath -NoTypeInformation -Encoding utf8
$rows | Format-Table -AutoSize
Write-Output "Prepared $($rows.Count) maps. Report: $reportPath"
