param(
    [string]$AssetsRoot = "C:\Users\danil\Desktop\rr4\allfilescopy\AssetRipper_export_20260610_230108\Assets",
    [string]$DestinationRoot = "C:\Users\danil\Desktop\rf4objects\catalogued"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$sourceRoot = Join-Path $AssetsRoot "PrefabHierarchyObject"
$bundleRoot = Join-Path $AssetsRoot "AssetBundle"

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "PrefabHierarchyObject not found: $sourceRoot"
}
if (-not (Test-Path -LiteralPath $bundleRoot -PathType Container)) {
    throw "AssetBundle not found: $bundleRoot"
}

$sourceRoot = (Resolve-Path -LiteralPath $sourceRoot).Path
$bundleRoot = (Resolve-Path -LiteralPath $bundleRoot).Path
New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
$destinationRootResolved = (Resolve-Path -LiteralPath $DestinationRoot).Path
$reportRoot = Join-Path $destinationRootResolved "_reports"
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

$sourceByName = [System.Collections.Generic.Dictionary[string, System.IO.FileInfo]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -File -Filter "*.glb") {
    $sourceByName[$file.Name] = $file
}

$entries = [System.Collections.Generic.List[object]]::new()
foreach ($manifestFile in Get-ChildItem -LiteralPath $bundleRoot -File -Filter "*.json" | Sort-Object Name) {
    $manifest = Get-Content -LiteralPath $manifestFile.FullName -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($property in $manifest.m_Container.PSObject.Properties) {
        $assetPath = $property.Name.Replace("\", "/")
        if (-not $assetPath.EndsWith(".prefab", [StringComparison]::OrdinalIgnoreCase)) { continue }
        if (-not $assetPath.StartsWith("assets/gfx/", [StringComparison]::OrdinalIgnoreCase)) { continue }

        $sourceFileName = [IO.Path]::GetFileNameWithoutExtension($assetPath) + ".glb"
        $relativePath = $assetPath.Substring("assets/gfx/".Length)
        $relativePath = [IO.Path]::ChangeExtension($relativePath, ".glb").Replace("/", [IO.Path]::DirectorySeparatorChar)

        if ([IO.Path]::IsPathRooted($relativePath) -or $relativePath.Split([IO.Path]::DirectorySeparatorChar) -contains "..") {
            throw "Unsafe manifest path: $assetPath"
        }

        $entries.Add([PSCustomObject]@{
            Bundle = [string]$manifest.m_AssetBundleName
            Manifest = $manifestFile.Name
            AssetPath = $assetPath
            SourceFileName = $sourceFileName
            RelativePath = $relativePath
        })
    }
}

$manualOverrides = @(
    [PSCustomObject]@{ SourceFileName = "bullhead_euro.glb"; RelativePath = "fish\bullhead_euro\prefabs\bullhead_euro.glb"; AssetPath = "assets/gfx/fish/bullhead_euro/prefabs/bullhead_euro.prefab"; Reason = "The full model is the prefabs entry" },
    [PSCustomObject]@{ SourceFileName = "bullhead_euro_0.glb"; RelativePath = "fish\bullhead_euro\bullhead_euro.glb"; AssetPath = "assets/gfx/fish/bullhead_euro/bullhead_euro.prefab"; Reason = "The 204-byte wrapper is the root entry" },
    [PSCustomObject]@{ SourceFileName = "tiny_fish.glb"; RelativePath = "fish\tiny_fish\tiny_fish.glb"; AssetPath = "assets/gfx/fish/tiny_fish/tiny_fish.prefab"; Reason = "The 200-byte wrapper is the fish root entry" },
    [PSCustomObject]@{ SourceFileName = "tiny_fish_0.glb"; RelativePath = "baits\live_fish\tiny_fish.glb"; AssetPath = "assets/gfx/baits/live_fish/tiny_fish.prefab"; Reason = "The full skinned model is the live bait entry" },
    [PSCustomObject]@{ SourceFileName = "spin_5319.glb"; RelativePath = "reels\sputnik\spin_5319\spin_5319.glb"; AssetPath = "assets/gfx/reels/sputnik/spin_5319/spin_5319.prefab"; Reason = "Embedded texture is branded Sputnik ALFA X4000" },
    [PSCustomObject]@{ SourceFileName = "spin_5319_0.glb"; RelativePath = "reels\sat\spin_5319\spin_5319.glb"; AssetPath = "assets/gfx/reels/sat/spin_5319/spin_5319.prefab"; Reason = "Embedded texture is branded Azimut" },
    [PSCustomObject]@{ SourceFileName = "spin_5324.glb"; RelativePath = "reels\trident\spin_5324\spin_5324.glb"; AssetPath = "assets/gfx/reels/trident/spin_5324/spin_5324.prefab"; Reason = "Embedded texture is branded Trident" },
    [PSCustomObject]@{ SourceFileName = "spin_5324_0.glb"; RelativePath = "reels\sat\spin_5324\spin_5324.glb"; AssetPath = "assets/gfx/reels/sat/spin_5324/spin_5324.prefab"; Reason = "Embedded texture is branded Azimut Goliath" }
)
$resolvedConflictNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($override in $manualOverrides) {
    if (-not $override.SourceFileName.EndsWith("_0.glb", [StringComparison]::OrdinalIgnoreCase)) {
        [void]$resolvedConflictNames.Add($override.SourceFileName)
    }
}

$conflictingNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$conflictRows = [System.Collections.Generic.List[object]]::new()
foreach ($group in $entries | Group-Object SourceFileName) {
    $paths = @($group.Group.AssetPath | Sort-Object -Unique)
    if ($paths.Count -le 1) { continue }
    [void]$conflictingNames.Add($group.Name)
    if ($resolvedConflictNames.Contains($group.Name)) { continue }
    foreach ($entry in $group.Group) {
        $conflictRows.Add([PSCustomObject]@{
            SourceFileName = $entry.SourceFileName
            Bundle = $entry.Bundle
            AssetPath = $entry.AssetPath
            Reason = "The flattened source name maps to multiple asset paths"
        })
    }
}

$manifestRows = [System.Collections.Generic.List[object]]::new()
$missingRows = [System.Collections.Generic.List[object]]::new()
$mappedSourceNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

foreach ($entry in $entries) {
    if ($conflictingNames.Contains($entry.SourceFileName)) { continue }
    if (-not $sourceByName.ContainsKey($entry.SourceFileName)) {
        $missingRows.Add([PSCustomObject]@{
            SourceFileName = $entry.SourceFileName
            Bundle = $entry.Bundle
            AssetPath = $entry.AssetPath
            Reason = "No exact GLB name in PrefabHierarchyObject"
        })
        continue
    }

    $source = $sourceByName[$entry.SourceFileName]
    $target = Join-Path $destinationRootResolved $entry.RelativePath
    $targetDirectory = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null

    $status = "linked"
    if (Test-Path -LiteralPath $target) {
        $targetInfo = Get-Item -LiteralPath $target
        $status = if ($targetInfo.Length -eq $source.Length) { "already_present" } else { "destination_conflict" }
    } else {
        New-Item -ItemType HardLink -Path $target -Target $source.FullName | Out-Null
    }

    [void]$mappedSourceNames.Add($source.Name)
    $manifestRows.Add([PSCustomObject]@{
        SourceFileName = $source.Name
        SourcePath = $source.FullName
        DestinationPath = $target
        RelativePath = $entry.RelativePath
        Bundle = $entry.Bundle
        AssetPath = $entry.AssetPath
        Bytes = $source.Length
        Status = $status
    })
}

foreach ($override in $manualOverrides) {
    if (-not $sourceByName.ContainsKey($override.SourceFileName)) { continue }
    $source = $sourceByName[$override.SourceFileName]
    $target = Join-Path $destinationRootResolved $override.RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null

    $status = "linked"
    if (Test-Path -LiteralPath $target) {
        $targetInfo = Get-Item -LiteralPath $target
        $status = if ($targetInfo.Length -eq $source.Length) { "already_present" } else { "destination_conflict" }
    } else {
        New-Item -ItemType HardLink -Path $target -Target $source.FullName | Out-Null
    }

    [void]$mappedSourceNames.Add($source.Name)
    $manifestRows.Add([PSCustomObject]@{
        SourceFileName = $source.Name
        SourcePath = $source.FullName
        DestinationPath = $target
        RelativePath = $override.RelativePath
        Bundle = "manual_resolution"
        AssetPath = $override.AssetPath
        Bytes = $source.Length
        Status = $status
    })
}

$unmappedRows = [System.Collections.Generic.List[object]]::new()
foreach ($source in $sourceByName.Values | Sort-Object Name) {
    if ($mappedSourceNames.Contains($source.Name) -or $conflictingNames.Contains($source.Name)) { continue }
    $unmappedRows.Add([PSCustomObject]@{
        SourceFileName = $source.Name
        SourcePath = $source.FullName
        Bytes = $source.Length
        Reason = "Not referenced by an exact, unambiguous AssetBundle prefab path"
    })
}

$reviewRows = [System.Collections.Generic.List[object]]::new()
foreach ($row in $unmappedRows) {
    $name = $row.SourceFileName.ToLowerInvariant()
    $category = "unclassified"
    $confidence = "low"
    $reason = "No safe manifest mapping"

    if ($name -match '^crock_pot_.*_0\.glb$') {
        $category = "unresolved_collisions"; $reason = "Two full models map to food and accessories"; $confidence = "low"
    } elseif ($name.Contains("spinnerbaits") -and $name.Contains("body") -or $name -match '^(hm_spinner.*body|old_spinnerlure_body|dragonfly_stream_body)') {
        $category = "internal_lure_parts"; $reason = "Shared lure body mesh, not a standalone prefab"; $confidence = "high"
    } elseif ($name -match '(^|_)(mono|fluoro|braid).*spool\.glb$|^snake_.*spool\.glb$|^pom_mono_spool\.glb$') {
        $category = "line_spools"; $reason = "Shared line spool model"; $confidence = "high"
    } elseif ($name -match '^(p_swlock|swlock_|fluoro_40.*_0)') {
        $category = "leader_parts"; $reason = "Shared leader or swivel component"; $confidence = "high"
    } elseif ($name -match '^rod_pod.*body\.glb$') {
        $category = "internal_equipment_parts"; $reason = "Rod pod body component"; $confidence = "high"
    } elseif ($name -match '^fish_(ceil|stand)') {
        $category = "display_props"; $reason = "Fish display or trophy stand"; $confidence = "high"
    } elseif ($name -match '^(dreissena_hook|worm_can)') {
        $category = "bait_parts"; $reason = "Bait-related component or container"; $confidence = "medium"
    } elseif ($name -match '^maps_inv_') {
        $category = "map_props"; $reason = "Inventory map model"; $confidence = "high"
    } elseif ($name -match '^lag_ny_pack') {
        $category = "food_props"; $reason = "Consumable package model"; $confidence = "medium"
    }

    $reviewTarget = Join-Path $destinationRootResolved (Join-Path "_review" (Join-Path $category $row.SourceFileName))
    New-Item -ItemType Directory -Path (Split-Path -Parent $reviewTarget) -Force | Out-Null
    $reviewStatus = "linked"
    if (Test-Path -LiteralPath $reviewTarget) {
        $reviewStatus = "already_present"
    } else {
        New-Item -ItemType HardLink -Path $reviewTarget -Target $row.SourcePath | Out-Null
    }
    $reviewRows.Add([PSCustomObject]@{
        SourceFileName = $row.SourceFileName
        ReviewCategory = $category
        Confidence = $confidence
        Reason = $reason
        DestinationPath = $reviewTarget
        Status = $reviewStatus
    })
}

$manifestRows | Sort-Object RelativePath | Export-Csv -LiteralPath (Join-Path $reportRoot "catalogue.csv") -NoTypeInformation -Encoding utf8
$conflictRows | Sort-Object SourceFileName, AssetPath | Export-Csv -LiteralPath (Join-Path $reportRoot "conflicts.csv") -NoTypeInformation -Encoding utf8
$missingRows | Sort-Object Bundle, AssetPath | Export-Csv -LiteralPath (Join-Path $reportRoot "missing-from-source.csv") -NoTypeInformation -Encoding utf8
$unmappedRows | Sort-Object SourceFileName | Export-Csv -LiteralPath (Join-Path $reportRoot "unmapped-source.csv") -NoTypeInformation -Encoding utf8
$reviewRows | Sort-Object ReviewCategory, SourceFileName | Export-Csv -LiteralPath (Join-Path $reportRoot "review-classification.csv") -NoTypeInformation -Encoding utf8

$summary = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    assetsRoot = $AssetsRoot
    sourceRoot = $sourceRoot
    destinationRoot = $destinationRootResolved
    sourceFiles = $sourceByName.Count
    manifestEntries = $entries.Count
    cataloguedFiles = $manifestRows.Count
    linked = @($manifestRows | Where-Object Status -eq "linked").Count
    alreadyPresent = @($manifestRows | Where-Object Status -eq "already_present").Count
    destinationConflicts = @($manifestRows | Where-Object Status -eq "destination_conflict").Count
    manuallyResolvedFiles = $manualOverrides.Count
    conflictingSourceNames = @($conflictRows | Select-Object -ExpandProperty SourceFileName -Unique).Count
    missingManifestEntries = $missingRows.Count
    unmappedSourceFiles = $unmappedRows.Count
    reviewFiles = $reviewRows.Count
    reviewUnclassified = @($reviewRows | Where-Object ReviewCategory -eq "unclassified").Count
    storageMode = "NTFS hard links; source files are not moved or deleted"
}

$summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reportRoot "summary.json") -Encoding utf8
$summary | Format-List
