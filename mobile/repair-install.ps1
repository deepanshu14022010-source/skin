$ErrorActionPreference = "Stop"

Write-Host "Repairing AKRIVO Skin mobile dependencies..."

if (Test-Path -LiteralPath ".\node_modules") {
  $backupName = ".node_modules_broken_{0}" -f (Get-Date -Format "yyyyMMddHHmmss")
  Write-Host "Moving corrupted node_modules to $backupName ..."
  Move-Item -LiteralPath ".\node_modules" -Destination $backupName -Force
}

if (Test-Path -LiteralPath ".\package-lock.json") {
  Write-Host "Removing stale package-lock.json..."
  Remove-Item -LiteralPath ".\package-lock.json" -Force
}

Write-Host "Cleaning npm cache..."
npm cache verify

Write-Host "Installing Expo dependencies..."
npm install

Write-Host "Running Expo Doctor..."
npx expo-doctor

Get-ChildItem -LiteralPath "." -Directory -Filter ".node_modules_broken_*" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Cleaning old dependency folder: $($_.Name)"
  try {
    [System.IO.Directory]::Delete($_.FullName, $true)
  } catch {
    Write-Host "Could not fully delete $($_.Name). It is safe to delete it later from File Explorer."
  }
}

Write-Host "Done. Start the app with: npx expo start"
