#!/bin/bash
# Recall Rogue — one-command Windows build + Steam deploy via the UTM Windows VM.
#
# The Mac cargo-xwin cross-compile path produces a broken 11 MB exe missing the
# embedded Tauri frontend. This script is the canonical working path: it syncs
# the source tree to the VM via tar+scp, runs scripts/vm-build-windows.ps1 on
# the VM to produce a ~1.35 GB exe, pulls the artifact back, stages it into
# steam/windows-build/, and optionally uploads to Steam via steamcmd.
#
# Usage:
#   ./scripts/steam-windows.sh                         # build + stage (no deploy)
#   ./scripts/steam-windows.sh --deploy                # build + stage + upload to Steam (VDF auto-promotes to default branch)
#   ./scripts/steam-windows.sh --deploy --setlive=beta  # override branch at upload time
#   ./scripts/steam-windows.sh --deploy-only           # upload already-staged build (no rebuild)
#   ./scripts/steam-windows.sh --skip-npm              # skip npm install on VM (deps unchanged)
#   ./scripts/steam-windows.sh --frontend-only         # build dist/ on VM but skip cargo (debug)
#   ./scripts/steam-windows.sh --vm-ip=192.168.128.102 # explicit VM IP (skip discovery)
#
# Environment overrides:
#   WIN_VM_IP           — pin VM IP (same as --vm-ip)
#   WIN_VM_HOSTNAME     — hostname prefix to match during discovery (default: WIN-)
#   WIN_VM_USER         — VM SSH user (default: damion)
#
# Performance budget (M4 Max + 1 Gbps virtio; measured 2026-04-20):
#   Discovery+ssh ping:  <1 s
#   tar on Mac:           4 s    (1.7 GB archive)
#   scp to VM:           45 s
#   tar -xf on VM:        7 s
#   npm install:         ~1 s (cached)  /  ~3 min (fresh)
#   frontend build:      45 s
#   cargo tauri x86_64:  4 min  (deps cached — fresh is ~25 min)
#   scp back:            45 s
#   Total build:        ~7 min with cached deps
#   + steamcmd deploy:  ~25 min (uploads 1.35 GB, hashes against prior depot)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGING_DIR="${HOME}/CODE/WINDOWS_VM"
ARTIFACT_DIR="$STAGING_DIR/build-artifacts"
WIN_BUILD_DIR="$PROJECT_ROOT/steam/windows-build"
WIN_VDF="$PROJECT_ROOT/steam/app_build_4547570_windows.vdf"
VM_USER="${WIN_VM_USER:-damion}"
VM_HOSTNAME_PREFIX="${WIN_VM_HOSTNAME:-WIN-}"

DO_BUILD=true
DO_DEPLOY=false
DO_INSTALL=false
SETLIVE_BRANCH=""
SKIP_NPM=false
FRONTEND_ONLY=false
VM_IP="${WIN_VM_IP:-}"
# Where the VM has Steam installed. Override via WIN_STEAM_INSTALL env var.
WIN_STEAM_INSTALL="${WIN_STEAM_INSTALL:-C:\\Program Files (x86)\\Steam\\steamapps\\common\\Recall Rogue}"

for arg in "$@"; do
    case $arg in
        --deploy)           DO_DEPLOY=true ;;
        --deploy-only)      DO_DEPLOY=true; DO_BUILD=false ;;
        --install)          DO_INSTALL=true ;;
        --install-only)     DO_INSTALL=true; DO_BUILD=false ;;
        --setlive=*)        SETLIVE_BRANCH="${arg#*=}" ;;
        --skip-npm)         SKIP_NPM=true ;;
        --frontend-only)    FRONTEND_ONLY=true ;;
        --vm-ip=*)          VM_IP="${arg#*=}" ;;
        -h|--help)
            grep -E '^#' "$0" | sed 's/^# \?//' | head -40
            exit 0
            ;;
        *) echo "Unknown flag: $arg"; echo "Run with --help for usage."; exit 1 ;;
    esac
done

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
dim() { printf '\033[2m%s\033[0m\n' "$1"; }

START_TS=$(date +%s)
step_start() { STEP_TS=$(date +%s); bold ">>> $1"; }
step_end() { local elapsed=$(( $(date +%s) - STEP_TS )); dim "    (${elapsed}s)"; }

# ---------- VM discovery ----------
if [[ -z "$VM_IP" ]]; then
    step_start "Discovering Windows VM on local subnet"
    # Scan ARP table for reachable SSH hosts, match hostname prefix
    for ip in $(arp -a 2>/dev/null | grep -oE '192\.168\.[0-9]+\.[0-9]+' | grep -v '\.255$' | grep -v '\.1$' | sort -u); do
        hostname=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes "$VM_USER@$ip" "hostname" 2>/dev/null || true)
        if [[ "$hostname" == $VM_HOSTNAME_PREFIX* ]]; then
            VM_IP="$ip"
            green "    Found: $VM_IP ($hostname)"
            break
        fi
    done
    if [[ -z "$VM_IP" ]]; then
        red "    VM not found. Is UTM running in Bridged networking?"
        red "    Try: --vm-ip=<ip>  or export WIN_VM_IP=<ip>"
        exit 2
    fi
    step_end
else
    bold ">>> Using VM IP: $VM_IP"
    if ! ssh -o ConnectTimeout=3 -o BatchMode=yes "$VM_USER@$VM_IP" "hostname" >/dev/null 2>&1; then
        red "    Cannot SSH to $VM_USER@$VM_IP"
        exit 2
    fi
fi

SSH="ssh -o ServerAliveInterval=30 $VM_USER@$VM_IP"

# ---------- Build ----------
if $DO_BUILD; then
    # Pre-flight: confirm pagefile is big enough (32 GB fixed). If not, the cargo
    # link step will OOM — fail early and guide the user.
    step_start "Pre-flight: checking VM pagefile"
    PAGEFILE_MB=$($SSH "powershell -Command \"(Get-CimInstance Win32_PageFileUsage | Select-Object -First 1).AllocatedBaseSize\"" 2>/dev/null | tr -d '[:space:]\r' | tr -d '\n')
    if [[ -z "$PAGEFILE_MB" ]] || [[ "$PAGEFILE_MB" -lt 30000 ]]; then
        red "    Pagefile is ${PAGEFILE_MB:-unknown} MB — need ≥30 GB to link the 1.6 GB embedded dist."
        red "    One-time fix (on VM):"
        red "      Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management' -Name PagingFiles -Value 'C:\\pagefile.sys 32768 49152' -Type MultiString"
        red "      Restart-Computer -Force"
        exit 3
    fi
    green "    Pagefile: ${PAGEFILE_MB} MB"
    step_end

    step_start "Creating source tar on Mac"
    # COPYFILE_DISABLE=1 + --exclude='._*' prevents macOS AppleDouble files from
    # landing on the VM (they crash libuv when Node's JSON.parse hits them).
    cd "$PROJECT_ROOT"
    COPYFILE_DISABLE=1 tar \
        --exclude='src-tauri/target' --exclude='node_modules' --exclude='.DS_Store' \
        --exclude='._*' --exclude='public/data/narratives/*.bak' \
        -cf "$STAGING_DIR/rr-sync.tar" \
        public src src-tauri scripts data/narratives data/decks \
        package.json package-lock.json vite.config.ts \
        tsconfig.json tsconfig.app.json tsconfig.node.json index.html svelte.config.js 2>&1 | head -5
    TAR_SIZE=$(du -h "$STAGING_DIR/rr-sync.tar" | cut -f1)
    dim "    tar size: $TAR_SIZE"
    step_end

    step_start "scp tar -> VM"
    scp -C "$STAGING_DIR/rr-sync.tar" "$VM_USER@$VM_IP:C:\\Users\\$VM_USER\\rr-sync.tar" >/dev/null
    step_end

    step_start "Unpacking on VM + dropping VM build script into place"
    # Wipe the 3 big dirs (tar merges, doesn't mirror) and unpack. scripts/vm-build-windows.ps1
    # inside the tar will replace the one the VM has been using.
    $SSH "powershell -Command \"Set-Location C:\\Users\\$VM_USER\\recall-rogue; Remove-Item -Recurse -Force public,src,src-tauri\\src,scripts -ErrorAction SilentlyContinue; tar -xf C:\\Users\\$VM_USER\\rr-sync.tar; Copy-Item scripts\\vm-build-windows.ps1 C:\\Users\\$VM_USER\\vm-build-windows.ps1 -Force\"" 2>&1 | tail -3
    step_end

    step_start "Running VM build (npm install + frontend + cargo tauri)"
    PS_ARGS=""
    if $SKIP_NPM; then PS_ARGS="$PS_ARGS -SkipNpmInstall"; fi
    if $FRONTEND_ONLY; then PS_ARGS="$PS_ARGS -FrontendOnly"; fi
    BUILD_LOG="$STAGING_DIR/vm-build-$(date +%Y%m%d-%H%M%S).log"
    set +e
    $SSH "powershell -ExecutionPolicy Bypass -File C:\\Users\\$VM_USER\\vm-build-windows.ps1 $PS_ARGS 2>&1" | tee "$BUILD_LOG" | grep -E '^(===|STEP FAILED|BUILD_OK|dist size|exe size|Compiling recall-rogue|Finished|Build complete|error\[|rustc-LLVM)' || true
    VM_EXIT=${PIPESTATUS[0]}
    set -e
    if [[ "$VM_EXIT" -ne 0 ]]; then
        red "    VM build failed (exit $VM_EXIT). Full log: $BUILD_LOG"
        exit $VM_EXIT
    fi
    # Belt-and-suspenders: PowerShell 'exit 1' inside Check-Exit doesn't always propagate
    # through SSH + cmd.exe + redirection, so trust the BUILD_OK marker instead.
    if ! grep -q "BUILD_OK" "$BUILD_LOG" 2>/dev/null; then
        red "    VM build failed — BUILD_OK marker missing. Likely STEP FAILED earlier. Full log: $BUILD_LOG"
        grep -E "STEP FAILED|error\[|rustc-LLVM|MODULE_NOT_FOUND" "$BUILD_LOG" 2>/dev/null | head -10 | sed 's/^/    /'
        exit 1
    fi
    step_end

    if $FRONTEND_ONLY; then
        green "Frontend-only build finished. Skipping artifact pull-back."
        exit 0
    fi

    step_start "Pulling artifacts VM -> Mac"
    mkdir -p "$ARTIFACT_DIR"
    scp "$VM_USER@$VM_IP:/Users/$VM_USER/win-build-artifacts/recall-rogue.exe" "$ARTIFACT_DIR/" >/dev/null
    scp "$VM_USER@$VM_IP:/Users/$VM_USER/win-build-artifacts/steam_api64.dll" "$ARTIFACT_DIR/" >/dev/null 2>&1 || yellow "    steam_api64.dll missing"
    scp "$VM_USER@$VM_IP:/Users/$VM_USER/win-build-artifacts/steam_appid.txt" "$ARTIFACT_DIR/" >/dev/null 2>&1 || true
    step_end

    step_start "Staging into steam/windows-build/"
    mkdir -p "$WIN_BUILD_DIR"
    cp "$ARTIFACT_DIR/recall-rogue.exe" "$WIN_BUILD_DIR/recall-rogue.exe"
    [[ -f "$ARTIFACT_DIR/steam_api64.dll" ]] && cp "$ARTIFACT_DIR/steam_api64.dll" "$WIN_BUILD_DIR/steam_api64.dll"
    [[ -f "$ARTIFACT_DIR/steam_appid.txt" ]] && cp "$ARTIFACT_DIR/steam_appid.txt" "$WIN_BUILD_DIR/steam_appid.txt"

    EXE_SIZE_MB=$(( $(stat -f%z "$WIN_BUILD_DIR/recall-rogue.exe") / 1024 / 1024 ))
    if [[ "$EXE_SIZE_MB" -lt 500 ]]; then
        red "    exe is ${EXE_SIZE_MB} MB — frontend did not embed. Aborting."
        exit 4
    fi
    green "    Staged: recall-rogue.exe (${EXE_SIZE_MB} MB)"
    step_end
fi

# ---------- Deploy ----------
if $DO_DEPLOY; then
    if [[ ! -f "$WIN_BUILD_DIR/recall-rogue.exe" ]]; then
        red "No exe at $WIN_BUILD_DIR/recall-rogue.exe — run without --deploy-only first."
        exit 5
    fi

    ENV_FILE="$PROJECT_ROOT/.env.local"
    STEAM_USER=$(grep STEAM_USERNAME "$ENV_FILE" | cut -d= -f2 | tr -d ' ')
    if [[ -z "$STEAM_USER" ]]; then
        red "STEAM_USERNAME not in $ENV_FILE"
        exit 6
    fi

    # Swap setlive if requested. Keep original and restore on exit.
    if [[ -n "$SETLIVE_BRANCH" ]]; then
        step_start "Setting VDF setlive branch: $SETLIVE_BRANCH"
        cp "$WIN_VDF" "$WIN_VDF.bak"
        # shellcheck disable=SC2016
        sed -i.sed-tmp "s/\"setlive\" \"[^\"]*\"/\"setlive\" \"$SETLIVE_BRANCH\"/" "$WIN_VDF"
        rm -f "$WIN_VDF.sed-tmp"
        trap 'mv "$WIN_VDF.bak" "$WIN_VDF" 2>/dev/null || true' EXIT
        step_end
    fi

    step_start "Uploading to Steam as $STEAM_USER (depot 4547572)"
    UPLOAD_LOG="$STAGING_DIR/steam-upload-$(date +%Y%m%d-%H%M%S).log"
    set +e
    steamcmd +login "$STEAM_USER" +run_app_build "$WIN_VDF" +quit > "$UPLOAD_LOG" 2>&1
    STEAMCMD_EXIT=$?
    set -e
    # Summarize the log (progress lines are stripped)
    grep -vE '^ [0-9.]+(KB|MB) \([0-9]+%\)$' "$UPLOAD_LOG" | tail -20
    if [[ "$STEAMCMD_EXIT" -ne 0 ]]; then
        red "    steamcmd exit $STEAMCMD_EXIT — see $UPLOAD_LOG"
        exit $STEAMCMD_EXIT
    fi
    if ! grep -q 'Successfully finished' "$UPLOAD_LOG"; then
        red "    Upload did not complete successfully. See $UPLOAD_LOG"
        exit 7
    fi
    BUILDID=$(grep -oE 'BuildID [0-9]+' "$UPLOAD_LOG" | head -1 | awk '{print $2}')
    green "    Steam BuildID: $BUILDID"
    step_end
fi

if $DO_INSTALL; then
    step_start "Installing to VM Steam folder ($WIN_STEAM_INSTALL)"
    # Source: the artifacts we just staged on the VM side are still in
    # /Users/$VM_USER/win-build-artifacts/. Copy from there to the VM's Steam
    # install via PowerShell Copy-Item (VM-local; no Mac→VM retransfer).
    ssh -o ConnectTimeout=10 "$VM_USER@$VM_IP" \
        "powershell.exe -Command \"Copy-Item -Path '/Users/$VM_USER/win-build-artifacts/*' -Destination '$WIN_STEAM_INSTALL\\' -Force -Recurse\""
    green "    Installed to: $WIN_STEAM_INSTALL"
    step_end
fi

TOTAL=$(( $(date +%s) - START_TS ))
bold "Done in ${TOTAL}s."
