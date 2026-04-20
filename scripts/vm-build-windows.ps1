# Recall Rogue — Windows VM build orchestrator
#
# Runs on the Windows 11 ARM64 UTM VM. Invoked from Mac via scripts/steam-windows.sh.
# Produces a release x86_64-pc-windows-msvc .exe with embedded Tauri frontend
# and stages it alongside steam_api64.dll + steam_appid.txt for pull-back.
#
# Pre-reqs (one-time, already provisioned on this VM):
#   - Node.js LTS, Git, Rust (rustup), MSVC BuildTools with Hostarm64/x64 cross tools
#   - Windows pagefile bumped to 32 GB fixed / 48 GB max (required — see docs/gotchas.md 2026-04-20)
#   - C:\Users\damion\recall-rogue\ populated via tar -xf
#
# Steps:
#   1. Refresh PATH and load MSVC x64 cross tools (Hostarm64 -> x64)
#   2. npm install (no scripts — avoids the prebuild hook)
#   3. Inline frontend build (strip/audit/convert-webp/narratives/facts/curated/vite/obfuscate)
#   4. cargo tauri build --target x86_64-pc-windows-msvc --no-bundle
#   5. Stage recall-rogue.exe + steam_api64.dll + steam_appid.txt to C:\Users\damion\win-build-artifacts\
#
# IMPORTANT: Do not set $ErrorActionPreference = "Stop". Several Node scripts in step 3
# legitimately print warnings to stderr (e.g. audit-fact-sprites.mjs writing "facts.db not found").
# Use cmd /c "... 2>&1" and check $LASTEXITCODE explicitly.

param(
    [switch]$SkipNpmInstall,    # skip if package-lock.json didn't change
    [switch]$FrontendOnly       # stop after vite build (skip cargo — useful for frontend iteration)
)

$ErrorActionPreference = "Continue"
$vmRoot = "C:\Users\damion\recall-rogue"
Set-Location $vmRoot

function Check-Exit($step) {
    if ($LASTEXITCODE -ne 0) {
        Write-Host "STEP FAILED: $step exit=$LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

# ---- Step 1: load toolchain PATH ----
Write-Host "=== Step 1: PATH + MSVC cross tools ===" -ForegroundColor Cyan
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')

$vsBase = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools'
if (-Not (Test-Path $vsBase)) {
    Write-Host "MSVC BuildTools not found at $vsBase" -ForegroundColor Red; exit 2
}
$msvcVer = (Get-ChildItem "$vsBase\VC\Tools\MSVC" -Directory | Select-Object -First 1).Name
$env:Path = "$vsBase\VC\Tools\MSVC\$msvcVer\bin\Hostarm64\x64;$env:Path"

$sdkBase = 'C:\Program Files (x86)\Windows Kits\10'
$sdkVer  = (Get-ChildItem "$sdkBase\Lib" -Directory | Where-Object { $_.Name -match '^10\.' } | Sort-Object Name -Descending | Select-Object -First 1).Name
$env:Path = "$sdkBase\bin\$sdkVer\x64;$env:Path"
$env:LIB  = "$vsBase\VC\Tools\MSVC\$msvcVer\lib\x64;$sdkBase\Lib\$sdkVer\um\x64;$sdkBase\Lib\$sdkVer\ucrt\x64"
$env:INCLUDE = "$vsBase\VC\Tools\MSVC\$msvcVer\include;$sdkBase\Include\$sdkVer\ucrt;$sdkBase\Include\$sdkVer\um;$sdkBase\Include\$sdkVer\shared"
Write-Host "MSVC: $msvcVer   SDK: $sdkVer"

# ---- Step 2: npm install ----
if (-Not $SkipNpmInstall) {
    Write-Host "=== Step 2: npm install ===" -ForegroundColor Cyan
    cmd /c "npm install --no-fund --no-audit --ignore-scripts 2>&1"
    Check-Exit "npm install"
} else {
    Write-Host "=== Step 2: npm install SKIPPED ===" -ForegroundColor Yellow
}

# ---- Step 3: inline frontend build ----
# These are the scripts npm run build would invoke. We run them inline so we can
# pass --no-strict where needed and avoid the npm prebuild hook's behavior.
Write-Host "=== Step 3: frontend build ===" -ForegroundColor Cyan

# sql.js WASM must be copied before vite build
Copy-Item "node_modules\sql.js\dist\sql-wasm.wasm" "public\sql-wasm.wasm" -Force

cmd /c "node scripts/strip-asset-metadata.mjs 2>&1";         Check-Exit "strip-asset-metadata"
cmd /c "node scripts/audit-fact-sprites.mjs --emit-manifest 2>&1"; Check-Exit "audit-fact-sprites"
cmd /c "node scripts/convert-to-webp.mjs --no-strict 2>&1";  Check-Exit "convert-to-webp"
cmd /c "node scripts/gen-sprite-keys.mjs 2>&1";              Check-Exit "gen-sprite-keys"
cmd /c "node scripts/audit-assets.mjs 2>&1";                 Check-Exit "audit-assets"
cmd /c "node scripts/build-narratives.mjs 2>&1";             Check-Exit "build-narratives"
cmd /c "node scripts/build-facts-db.mjs 2>&1";               Check-Exit "build-facts-db"
cmd /c "node scripts/build-curated-db.mjs 2>&1";             Check-Exit "build-curated-db"
cmd /c "npx vite build 2>&1";                                Check-Exit "vite build"
cmd /c "node scripts/obfuscate-db.mjs 2>&1";                 Check-Exit "obfuscate-db"

$distSize = (Get-ChildItem dist -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ("dist size: {0:N1} MB" -f $distSize)
if ($distSize -lt 1000) {
    Write-Host "dist/ suspiciously small — expected >1 GB" -ForegroundColor Red; exit 3
}

if ($FrontendOnly) {
    Write-Host "=== FrontendOnly — stopping before cargo ===" -ForegroundColor Yellow
    exit 0
}

# ---- Step 4: cargo tauri build x86_64 ----
# --no-bundle: skip msi/nsis installer, ship raw exe (Steam is the installer)
# beforeBuildCommand set to empty: we already built the frontend above
Write-Host "=== Step 4: cargo tauri build x86_64 ===" -ForegroundColor Cyan
Set-Location "$vmRoot\src-tauri"
cmd /c "cargo tauri build --target x86_64-pc-windows-msvc --no-bundle --config `"{\`"build\`":{\`"beforeBuildCommand\`":\`"\`"}}`" 2>&1"
Check-Exit "cargo tauri build"

# ---- Step 5: stage artifacts ----
Write-Host "=== Step 5: stage artifacts ===" -ForegroundColor Cyan
$stageDir = "$env:USERPROFILE\win-build-artifacts"
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir | Out-Null

$exePath = "$vmRoot\src-tauri\target\x86_64-pc-windows-msvc\release\recall-rogue.exe"
if (-Not (Test-Path $exePath)) {
    Write-Host "exe not found at $exePath" -ForegroundColor Red; exit 4
}
$exeSize = (Get-Item $exePath).Length / 1MB
Write-Host ("exe size: {0:N1} MB" -f $exeSize)
if ($exeSize -lt 500) {
    Write-Host "exe too small ($exeSize MB) — frontend did not embed" -ForegroundColor Red; exit 5
}
Copy-Item $exePath "$stageDir\recall-rogue.exe"

# steam_api64.dll — try src-tauri/ first, then fallback to steamworks-sys build output
$dllSrc = "$vmRoot\src-tauri\steam_api64.dll"
if (-Not (Test-Path $dllSrc)) {
    $dllSrc = (Get-ChildItem "$vmRoot\src-tauri\target\x86_64-pc-windows-msvc\release" -Filter "steam_api64.dll" -Recurse | Select-Object -First 1).FullName
}
if ($dllSrc -and (Test-Path $dllSrc)) {
    Copy-Item $dllSrc "$stageDir\steam_api64.dll"
} else {
    Write-Host "steam_api64.dll not found — Steam init will fail at runtime" -ForegroundColor Yellow
}

Copy-Item "$vmRoot\src-tauri\steam_appid.txt" "$stageDir\steam_appid.txt" -ErrorAction SilentlyContinue

Write-Host "=== Stage contents ===" -ForegroundColor Cyan
Get-ChildItem $stageDir | ForEach-Object { Write-Host ("  {0}  {1:N1} MB" -f $_.Name, ($_.Length/1MB)) }

Write-Host "BUILD_OK" -ForegroundColor Green
