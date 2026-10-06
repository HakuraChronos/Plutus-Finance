$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$packageRoot = Join-Path $projectRoot "dist\Plutus-Windows"
$indexPath = Join-Path $projectRoot "app\index.html"
$cssPath = Join-Path $projectRoot "app\css"
$jsPath = Join-Path $projectRoot "app\js"

Push-Location $projectRoot
try {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    $pythonExe = if ($pythonCommand -and $pythonCommand.Source -notlike "*WindowsApps*") {
        $pythonCommand.Source
    } else {
        Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe" -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $pythonExe) {
        throw "Python 3.10 or newer is required to build Plutus.exe."
    }

    & $pythonExe -c "import PyInstaller, webview" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Build dependencies are missing. Run: python -m pip install -r requirements-build.txt"
    }

    & $pythonExe -m PyInstaller `
        --noconfirm `
        --clean `
        --onefile `
        --windowed `
        --name Plutus `
        --hidden-import webview.platforms.edgechromium `
        --collect-all webview `
        --distpath "dist\binary" `
        --workpath "build" `
        --specpath "build" `
        --add-data "$indexPath;." `
        --add-data "$cssPath;css" `
        --add-data "$jsPath;js" `
        "app\launcher.py"

    if (Test-Path -LiteralPath $packageRoot) {
        Remove-Item -LiteralPath $packageRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot "User_data") | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $packageRoot "Documentation") | Out-Null

    Copy-Item -LiteralPath "dist\binary\Plutus.exe" -Destination (Join-Path $packageRoot "Plutus.exe")
    Copy-Item -LiteralPath "dist\binary\Plutus.exe" -Destination (Join-Path $projectRoot "Plutus.exe") -Force
    Copy-Item -LiteralPath "README.md" -Destination (Join-Path $packageRoot "README.md")
    Copy-Item -LiteralPath "docs\SECURITY.md" -Destination (Join-Path $packageRoot "Documentation")
    Set-Content -LiteralPath (Join-Path $packageRoot "User_data\README.txt") -Encoding UTF8 -Value @(
        "Plutus stores encrypted profiles in this folder."
        "Do not edit or delete its contents unless you intend to remove your financial data."
    )

    $archive = Join-Path $projectRoot "dist\Plutus-Windows.zip"
    if (Test-Path -LiteralPath $archive) {
        Remove-Item -LiteralPath $archive -Force
    }
    Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $archive -CompressionLevel Optimal

    Write-Host ""
    Write-Host "Build complete: dist\Plutus-Windows.zip" -ForegroundColor Green
} finally {
    Pop-Location
}
