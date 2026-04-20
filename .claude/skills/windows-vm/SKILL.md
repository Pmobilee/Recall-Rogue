---
name: windows-vm
description: Connect to the Windows 11 ARM64 VM (UTM) for building, testing, and deploying the Windows Tauri build. Auto-discovers the VM IP on the local network.
---

# Windows VM — Connection & Management

The project has a Windows 11 ARM64 VM running in UTM (bridged networking) for native Windows builds and testing. SSH key auth is configured. The project lives on the VM at `C:\Users\damion\recall-rogue` and is synced from the Mac via tar+scp over SSH.

## 🚀 One-Command Build — `./scripts/steam-windows.sh`

For 99% of Windows builds, just run:

```bash
./scripts/steam-windows.sh                              # build + stage (no upload)
./scripts/steam-windows.sh --deploy                     # build + stage + upload to Steam (auto-promotes to default branch via VDF setlive)
./scripts/steam-windows.sh --deploy --setlive=beta      # upload and override branch
./scripts/steam-windows.sh --deploy-only                # re-upload staged build (no rebuild)
./scripts/steam-windows.sh --skip-npm                   # skip npm install (deps unchanged)
./scripts/steam-windows.sh --frontend-only              # build dist/ on VM only, skip cargo
./scripts/steam-windows.sh --vm-ip=192.168.128.102      # pin VM IP (skip discovery)
```

The script is the canonical Windows path. It auto-discovers the VM IP, pre-flights the pagefile (must be ≥30 GB — fix below if not), tars the source, `scp`s to the VM, runs `scripts/vm-build-windows.ps1` on the VM, pulls back the ~1.35 GB exe, stages it into `steam/windows-build/`, validates size, and optionally uploads via `steamcmd`. Total time with warm caches: ~7 min build, ~25 min deploy.

`scripts/steam-build.sh --windows [flags]` delegates to this script — both entrypoints land on the same path.

The sections below document the manual primitives (tar/scp sync, MSVC cross tools, pagefile recipe) for when you need to debug or extend the script. Don't run them by hand unless the script is broken.

## Connection Details

- **Username:** damion
- **Password (fallback):** chrx
- **SSH key:** ed25519 key at `~/.ssh/id_ed25519` (already in VM's `administrators_authorized_keys`)
- **Network:** Bridged mode. Subnet varies by environment — has been seen on `192.168.11.x` and `192.168.128.x`. Always discover dynamically; never hard-code the subnet.
- **Hostname:** WIN-0LQQEHDQT05
- **VM app:** UTM (`/Applications/UTM.app`)

## Connecting — Always Start Here

The VM's IP and subnet can change between boots / networks. Discover from the current ARP table instead of assuming a fixed subnet:

```bash
# Step 1: Find the VM by probing every recent ARP neighbor for SSH
for ip in $(arp -a | grep -oE '[0-9]{1,3}(\.[0-9]{1,3}){3}' | sort -u | grep -v '\.255$' | grep -v '\.1$'); do
  result=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes damion@$ip "hostname" 2>/dev/null)
  if [ "$result" = "WIN-0LQQEHDQT05" ]; then echo "FOUND: $ip"; break; fi
done

# Step 2: Verify connection
ssh damion@<IP> "echo connected && hostname && systeminfo | findstr /B /C:'OS Name' /C:'OS Version' /C:'System Type'"
```

If key auth fails, fall back to password:
```bash
sshpass -p 'chrx' ssh damion@<IP> "echo connected"
```

## Running Commands

All commands run via SSH. For PowerShell commands, wrap in `powershell -Command "..."`:

```bash
# Simple cmd
ssh damion@<IP> "dir C:\Users\damion"

# PowerShell
ssh damion@<IP> "powershell -Command \"Get-Process | Select-Object -First 5\""

# Long-running (use timeout and keepalive)
ssh -o ServerAliveInterval=30 damion@<IP> "powershell -Command \"npm run build 2>&1\""
```

## Installed Tools (verified 2026-04-14)

| Tool | Version | Install method |
|---|---|---|
| Node.js | v24.14.1 (ARM64) | winget `OpenJS.NodeJS.LTS` |
| Git | 2.53.0 (ARM64) | winget `Git.Git` |
| Rust | 1.94.1 (aarch64-pc-windows-msvc) | rustup |
| Cargo | 1.94.1 | rustup |
| MSVC | 14.44.35207 | winget `Microsoft.VisualStudio.2022.BuildTools` |

Check versions:
```bash
ssh damion@<IP> "powershell -Command \"\$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); node --version; git --version; rustc --version; cargo --version\""
```

Install new tools (always use `--source winget` to skip broken msstore):
```bash
ssh damion@<IP> "powershell -Command \"winget install -e --id <PACKAGE_ID> --source winget --accept-package-agreements --accept-source-agreements 2>&1\""
```

## Project Sync & File Layout

The project is NOT cloned via git on the VM. It is rsynced from the Mac to avoid needing GitHub credentials on the VM and because the Mac repo contains more data than what's on GitHub.

- **Mac source:** `/Users/damion/CODE/Recall_Rogue/`
- **VM destination:** `C:\Users\damion\recall-rogue\`
- **Mac artifact staging:** `/Users/damion/CODE/WINDOWS_VM/` (for pulling build artifacts back)
- **VM shared drive:** `Z:\` (UTM VirtioFS) maps to `/Users/damion/CODE/WINDOWS_VM/` on Mac. Preferred for file transfer — faster and more reliable than rsync over SSH (which fails due to Windows cmd.exe shell quirks)

### Sync Mac -> VM — tar + scp, NOT rsync or VirtioFS

**The tested-and-working path is: single tar on Mac → `scp` to VM → `tar.exe -xf` on VM's C:.** Do not use rsync (not installed on Windows), do not use robocopy over `Z:\` (per-file VirtioFS overhead is catastrophic — 30+ min for 4000 small files), and do not rely on reading large files from `Z:\` (UTM VirtioFS on Windows silently caps reads at ~2 GB with `"The file size exceeds the limit allowed"` — PowerShell `Copy-Item` and `Expand-Archive` both fail on anything bigger).

Confirmed 2026-04-20 on an 8 Gbps virtual link:
- `tar -cf` of `public/` + `src/` + `src-tauri/` (excl target) + root configs (~1.7 GB, 4700+ files): **~4 s**
- `scp -C` of the 1.7 GB tar over SSH: **~30–60 s** depending on dev traffic
- `tar -xf` on the VM from local `C:\`: **~20 s**
- Total end-to-end: **~90 s**
- Robocopy on the same payload: **hung at 80% after 30+ minutes, never completed**

**Canonical sync workflow:**

```bash
# 1. Mac: tar the source tree to /Users/damion/CODE/WINDOWS_VM/ (scratch dir, NOT a transfer — tar is local)
# COPYFILE_DISABLE=1 prevents macOS from embedding ._AppleDouble resource-fork files.
# Without it, the VM ends up with 5k+ ._*.json files that crash Node when a build script
# tries to JSON.parse them (e.g. build-facts-db.mjs hits `._bridge-curated.json` and
# segfaults libuv with `Assertion failed: UV_HANDLE_CLOSING, src\win\async.c`).
cd /Users/damion/CODE/Recall_Rogue
time COPYFILE_DISABLE=1 tar \
  --exclude='src-tauri/target' --exclude='node_modules' --exclude='.DS_Store' \
  --exclude='._*' --exclude='public/data/narratives/*.bak' \
  -cf /Users/damion/CODE/WINDOWS_VM/rr-sync.tar \
  public src src-tauri \
  package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html svelte.config.js

# 2. Mac: scp the tar to the VM's C: drive (bypasses the VirtioFS 2 GB read limit)
time scp -C /Users/damion/CODE/WINDOWS_VM/rr-sync.tar damion@<IP>:'C:\Users\damion\rr-sync.tar'

# 3. VM: wipe stale dirs, then tar -xf from C:\ (Windows 11 ships tar.exe from libarchive — handles any size)
ssh damion@<IP> "powershell -Command \"cd C:\Users\damion\recall-rogue; Remove-Item -Recurse -Force public -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force src -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force src-tauri\src -ErrorAction SilentlyContinue; tar -xf C:\Users\damion\rr-sync.tar; Get-ChildItem public -Recurse -File | Measure-Object | Select-Object Count\""
```

**Why not plain zip:** PowerShell's `Expand-Archive` uses `System.IO.Compression.ZipFile` which errors on zip64 and archives near 2 GB with `"The file size exceeds the limit allowed and cannot be saved."` Tar has no such limit and is 1:1 as fast on store-only archives.

**Why not rsync:** No rsync binary on Windows 11 ARM. The `cwRsync` winget package does not exist in the public winget source (verified 2026-04-20). Installing Cygwin just for rsync adds a maintenance burden for a problem that tar+scp already solves.

**Why not VirtioFS for big files:** UTM's VirtioFS driver on Windows has a ~2 GB single-file read cap — confirmed 2026-04-20 when both `Copy-Item Z:\rr-sync.tar C:\` and `tar -xf Z:\rr-sync.tar` failed with `"The file size exceeds the limit allowed and cannot be saved."` The file *shows up* in `dir Z:\` with the correct size, but reads past the cap fail. Below ~1 GB it works fine; above, switch to scp. If this ever needs to be crossed, split the tar: `split -b 900m rr-sync.tar rr-sync.tar.part-` on Mac, reassemble on VM with `cmd /c "copy /b rr-sync.tar.part-* rr-sync.tar"`.

**Rules:**
- Always wipe the target dirs with `Remove-Item -Recurse -Force` before `tar -xf`. Tar merges, it does not mirror — stale files would pile up otherwise.
- Keep the tar at `/Users/damion/CODE/WINDOWS_VM/rr-sync.tar` (and its VM copy at `C:\Users\damion\rr-sync.tar`) so subsequent diffs are easy to reason about. Delete both after a build cycle if disk pressure matters.
- For selective updates (only config files changed), tar just those paths — creation time scales with file count.

### Pulling artifacts back VM -> Mac

For build outputs (exe + DLLs + small set of files), plain `scp` is fine — it's a handful of files, not thousands:

```bash
scp damion@<IP>:'C:\Users\damion\recall-rogue\win-build-out\*' /Users/damion/CODE/WINDOWS_VM/build-artifacts/
```

If you ever need to pull back a whole `target/release/` tree, tar on the VM first and scp the tar (same reasoning as Mac → VM):

```bash
ssh damion@<IP> "powershell -Command \"tar -cf C:\Users\damion\rr-build-out.tar -C C:\Users\damion\recall-rogue\win-build-out .\""
scp damion@<IP>:'C:\Users\damion\rr-build-out.tar' /Users/damion/CODE/WINDOWS_VM/
tar -xf /Users/damion/CODE/WINDOWS_VM/rr-build-out.tar -C /Users/damion/CODE/Recall_Rogue/steam/windows-build/
```

### Pull artifacts VM -> Mac

```bash
# Copy Windows exe back
scp damion@<IP>:'C:\Users\damion\recall-rogue\src-tauri\target\release\bundle\nsis\*.exe' /Users/damion/CODE/WINDOWS_VM/
```

## Windows Build Workflow

See the canonical tar+scp sync above. The build step itself uses `cargo tauri build --target x86_64-pc-windows-msvc --no-bundle` — **`--no-bundle`**, not `--bundles none`. The latter has been invalid since Tauri 2.x (only `msi` and `nsis` are valid `--bundles` values). For Steam depot uploads the raw exe is what you want — no installer wrapper, since Steam is the installer.

Also: `cargo tauri build` passes through to `cargo build` and triggers `tauri.conf.json`'s `beforeBuildCommand` (`npm run build`). When the frontend has ALREADY been built in the sync step, pass `--config "{\"build\":{\"beforeBuildCommand\":\"\"}}"` to skip the duplicate frontend build on the VM.

```bash
# 1. Sync latest code from Mac (canonical tar+scp — see Sync section above)
COPYFILE_DISABLE=1 tar --exclude='src-tauri/target' --exclude='node_modules' --exclude='.DS_Store' --exclude='._*' -cf /Users/damion/CODE/WINDOWS_VM/rr-sync.tar public src src-tauri package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html svelte.config.js
scp -C /Users/damion/CODE/WINDOWS_VM/rr-sync.tar damion@<IP>:'C:\Users\damion\rr-sync.tar'
ssh damion@<IP> "powershell -Command \"cd C:\Users\damion\recall-rogue; Remove-Item -Recurse -Force public,src,src-tauri\src -ErrorAction SilentlyContinue; tar -xf C:\Users\damion\rr-sync.tar\""

# 2. Install/update npm deps (first time or after package.json changes)
ssh damion@<IP> "cd C:\Users\damion\recall-rogue && npm install --no-fund --no-audit --ignore-scripts"

# 3. Build frontend on VM (prebuild scripts + vite) — see build script template for exact sequence

# 4. Build Tauri x86_64 exe (NO installer, frontend already built)
#    Load MSVC cross tools FIRST: $vsBase\VC\Tools\MSVC\<ver>\bin\Hostarm64\x64 on PATH
ssh -o ServerAliveInterval=30 damion@<IP> "cd C:\Users\damion\recall-rogue\src-tauri && cargo tauri build --target x86_64-pc-windows-msvc --no-bundle --config `"{\`"build\`":{\`"beforeBuildCommand\`":\`"\`"}}`""

# 5. Copy artifact back to Mac
scp damion@<IP>:'C:\Users\damion\recall-rogue\src-tauri\target\x86_64-pc-windows-msvc\release\recall-rogue.exe' /Users/damion/CODE/WINDOWS_VM/build-artifacts/
```

### Memory pressure during link (LLVM OOM on 4 GB VM)

The release binary embeds the ~1.6 GB `dist/` folder via Tauri's `frontendDist` codegen. Linking it requires ~20–25 GB of committed memory for a brief window, which overflows the default system-managed 12 GB pagefile on a 4 GB VM. Symptom:

```
rustc-LLVM ERROR: out of memory
Allocation failed
error: could not compile `recall-rogue` (bin "recall-rogue")
... (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN)
```

Lowering `opt-level` does NOT help — the memory demand is from linking the embedded resource blob, not LLVM optimization passes. Tested opt-level=3 → 1 on 2026-04-20, same OOM.

**Fix: bump the pagefile to 32 GB fixed (48 GB max) and reboot.** Once, not per-build:

```powershell
# On the VM:
$c = Get-CimInstance Win32_ComputerSystem; $c.AutomaticManagedPagefile = $false; $c | Set-CimInstance
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" `
  -Name "PagingFiles" -Value "C:\pagefile.sys 32768 49152" -Type MultiString
Restart-Computer -Force
# After reboot, verify:
Get-CimInstance Win32_PageFileUsage | Select-Object Name,AllocatedBaseSize
# Should show: C:\pagefile.sys  32768
```

VM disk must have ≥50 GB free for this pagefile size. Once set, the link takes ~4 min and produces a ~1.35 GB exe.

**Do NOT use `cargo xwin build` from the Mac as the primary Windows path.** It produces an 11 MB exe that's missing the embedded frontend — the resulting Steam build is broken. The VM path above is the working path; see `docs/gotchas.md` 2026-04-20 "Windows cross-compile vs VM build".

## Troubleshooting

- **VM not found on network:** Make sure UTM VM is running and set to Bridged networking
- **SSH timeout:** VM may be booting. Wait 30s and retry
- **winget source errors:** Run `winget source reset --force && winget source update` first
- **msstore certificate errors:** Always add `--source winget` to winget install commands
- **PATH not refreshed after install:** Prepend `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User');` to PowerShell commands
- **Key auth fails:** Fix with `sshpass -p 'chrx' ssh damion@<IP> "powershell -Command \"Set-Content -Path 'C:\ProgramData\ssh\administrators_authorized_keys' -Value 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEH21agjJ+Rb9aCzEWOiXTSJj0C0QgVBvVr3yFan3muO mulda@IntelliDows'; icacls 'C:\ProgramData\ssh\administrators_authorized_keys' /inheritance:r /grant 'SYSTEM:(F)' /grant 'Administrators:(F)'; Restart-Service sshd\""
- **rsync backslash issues:** N/A — do not use rsync on Windows. See canonical tar+scp workflow.
- **"invalid value 'none' for '--bundles'"**: Use `--no-bundle` instead. Valid `--bundles` values in Tauri 2 are `msi` and `nsis` only.
- **PowerShell `$ErrorActionPreference = "Stop"` trapping native stderr as terminating errors**: Remove it from build scripts. Use `cmd /c "... 2>&1"` and check `$LASTEXITCODE` explicitly — Node scripts that print warnings to stderr (e.g. `audit-fact-sprites.mjs` printing `"facts.db not found at ..."`) would otherwise kill the entire build.
- **Node `Assertion failed: UV_HANDLE_CLOSING, src\win\async.c`** during a data build on the VM: you have macOS AppleDouble files (`._*.json`) in your synced tree. `build-facts-db.mjs` / `build-curated-db.mjs` call `JSON.parse` on every file matching the glob, and the 4-byte AppleDouble header crashes libuv when the error bubbles up. Always sync with `COPYFILE_DISABLE=1 tar ... --exclude='._*'`. If already present, purge with `Get-ChildItem public -Recurse -Filter '._*' | Remove-Item -Force`.

---

# Linux VM — Connection & Management

Debian 13 (trixie) x86_64 VM running in UTM (bridged networking) for native Linux builds. SSH key auth configured for both `damion` and `root`.

## Connection Details

- **Username:** damion (build user) / root (admin)
- **Password (both):** chrx
- **SSH key:** ed25519 key at `~/.ssh/id_ed25519` (installed in both `~damion/.ssh/authorized_keys` and `/root/.ssh/authorized_keys`)
- **Network:** Bridged mode on `192.168.11.x` subnet (IP may change on reboot)
- **Hostname:** debian-vm
- **VM app:** UTM (`/Applications/UTM.app`)
- **Architecture:** x86_64 (emulated on Apple Silicon — builds are slow, 1 vCPU)

## Connecting — Always Start Here

```bash
# Step 1: Find the VM by scanning for SSH (same method as Windows VM)
for ip in $(arp -a | grep '192.168.11' | grep -oE '192\.168\.11\.[0-9]+' | grep -v '\.255$' | grep -v '\.1$'); do
  result=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes damion@$ip "hostname" 2>/dev/null)
  if [ "$result" = "debian-vm" ]; then echo "FOUND: $ip"; break; fi
done

# Step 2: Verify connection
ssh damion@<IP> "uname -a && echo '---' && cat /etc/os-release | head -3"
```

## Installed Tools (verified 2026-04-16)

| Tool | Version | Install method |
|---|---|---|
| Node.js | v22.22.2 | nodesource apt repo |
| npm | 10.9.7 | bundled with Node |
| Git | 2.47.3 | apt |
| Rust | 1.94.1 (x86_64-unknown-linux-gnu) | rustup |
| Cargo | 1.94.1 | rustup |
| build-essential | gcc/g++ | apt |
| WebKitGTK | 4.1 | apt (libwebkit2gtk-4.1-dev) |
| GTK3 | 3.x | apt (libgtk-3-dev) |

Tauri Linux dependencies installed: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libssl-dev`, `pkg-config`.

Check versions:
```bash
ssh damion@<IP> ". ~/.cargo/env && node --version && npm --version && rustc --version && cargo --version && git --version"
```

## Project Sync & File Layout

- **Mac source:** `/Users/damion/CODE/Recall_Rogue/`
- **VM destination:** `/home/damion/recall-rogue/`
- **Mac artifact staging:** `/Users/damion/CODE/LINUX_VM/`
- **Mac shared drive:** `/Users/damion/CODE/LINUX_VM/` (configure UTM VirtioFS share to map here)

### Sync Mac -> VM (TARGETED — excludes 116GB data/ dir and macOS build artifacts)

**CRITICAL:** The `data/` directory is 116GB and `src-tauri/target/` has macOS build artifacts. ALWAYS exclude both. A sync without these exclusions will exhaust the VM's 75GB disk and crash it. Use `--exclude` rules (not `--include` with a trailing `--exclude='*'`) because rsync's include/exclude ordering is tricky — includes take priority and can accidentally pull in `src-tauri/target/`.

```bash
# Exclude-based sync (safer — everything EXCEPT the big dirs)
rsync -avz --progress \
  --exclude='src-tauri/target' --exclude='node_modules' --exclude='.git' \
  --exclude='data' --exclude='dist' --exclude='.video-tmp' \
  --exclude='.openclaude' --exclude='store-assets' --exclude='*.db' \
  --exclude='_archived_assets' --exclude='steam/output' \
  --exclude='steam/store-images' --exclude='steam/windows-build' \
  -e ssh /Users/damion/CODE/Recall_Rogue/ damion@<IP>:~/recall-rogue/
```

### Pull artifacts VM -> Mac

```bash
# Copy Linux AppImage back
scp damion@<IP>:~/recall-rogue/src-tauri/target/release/bundle/appimage/*.AppImage /Users/damion/CODE/LINUX_VM/

# Or copy the raw binary + libsteam_api.so
scp damion@<IP>:~/recall-rogue/src-tauri/target/release/recall-rogue /Users/damion/CODE/LINUX_VM/
```

## Linux Build Workflow

```bash
# 1. Sync latest code from Mac (exclude-based — safe from target/ and data/)
rsync -avz --progress \
  --exclude='src-tauri/target' --exclude='node_modules' --exclude='.git' \
  --exclude='data' --exclude='dist' --exclude='.video-tmp' \
  --exclude='.openclaude' --exclude='store-assets' --exclude='*.db' \
  --exclude='_archived_assets' --exclude='steam/output' \
  --exclude='steam/store-images' --exclude='steam/windows-build' \
  -e ssh /Users/damion/CODE/Recall_Rogue/ damion@<IP>:~/recall-rogue/

# 2. Install npm deps (first time or after package.json changes)
ssh damion@<IP> "cd ~/recall-rogue && npm install"

# 3. Build Tauri Linux binary
ssh -o ServerAliveInterval=30 damion@<IP> "cd ~/recall-rogue && . ~/.cargo/env && npm run build && cd src-tauri && cargo tauri build --bundles appimage 2>&1"

# 4. Find and stage the libsteam_api.so alongside the binary
ssh damion@<IP> "cd ~/recall-rogue && STEAMSO=\$(find src-tauri/target/release/build -name 'libsteam_api.so' -path '*/steamworks-sys-*/out/*' | head -1) && echo \$STEAMSO"

# 5. Copy artifacts to staging dir on VM for pull-back
ssh damion@<IP> "mkdir -p ~/linux-build && cp ~/recall-rogue/src-tauri/target/release/recall-rogue ~/linux-build/ && cp ~/recall-rogue/src-tauri/steam_appid.txt ~/linux-build/"

# 6. Pull artifacts back to Mac
scp damion@<IP>:~/linux-build/* /Users/damion/CODE/LINUX_VM/

# 7. Stage for Steam depot
cp /Users/damion/CODE/LINUX_VM/recall-rogue /Users/damion/CODE/Recall_Rogue/steam/linux-build/
cp /Users/damion/CODE/LINUX_VM/libsteam_api.so /Users/damion/CODE/Recall_Rogue/steam/linux-build/
cp /Users/damion/CODE/Recall_Rogue/src-tauri/steam_appid.txt /Users/damion/CODE/Recall_Rogue/steam/linux-build/
```

## Troubleshooting

- **VM not found on network:** Make sure UTM VM is running and set to Bridged networking
- **SSH timeout:** VM may be booting (slower than Windows VM). Wait 60s and retry
- **Out of disk:** The VM has 75GB. NEVER rsync `data/` (116GB). Check with `df -h /`
- **Out of memory:** VM has 4GB RAM. Cargo builds can OOM on 1 vCPU — if build fails, check `dmesg | tail`
- **Rust PATH:** Always prefix commands with `. ~/.cargo/env &&` — Rust is installed via rustup, not apt
- **sudo:** damion is in the sudo group. Use `sudo apt-get install ...` for system packages
- **Root access:** `ssh root@<IP>` works with key auth for admin tasks
- **Slow builds:** x86_64 emulated on ARM — Cargo builds take 10-30x longer than native. Be patient.
