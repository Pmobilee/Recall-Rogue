---
name: windows-vm
description: Connect to the Windows 11 ARM64 VM (UTM) for building, testing, and deploying the Windows Tauri build. Auto-discovers the VM IP on the local network.
---

# Windows VM — Connection & Management

The project has a Windows 11 ARM64 VM running in UTM (bridged networking) for native Windows builds and testing. SSH key auth is configured. The project lives on the VM at `C:\Users\damion\recall-rogue` and is synced from the Mac via rsync over SSH.

## Connection Details

- **Username:** damion
- **Password (fallback):** chrx
- **SSH key:** ed25519 key at `~/.ssh/id_ed25519` (already in VM's `administrators_authorized_keys`)
- **Network:** Bridged mode on `192.168.11.x` subnet (IP may change on reboot)
- **Hostname:** WIN-0LQQEHDQT05
- **VM app:** UTM (`/Applications/UTM.app`)

## Connecting — Always Start Here

The VM's IP can change between boots. Always discover it first:

```bash
# Step 1: Find the VM by scanning for SSH on the local subnet
for ip in $(arp -a | grep '192.168.11' | grep -oE '192\.168\.11\.[0-9]+' | grep -v '\.255$' | grep -v '\.1$'); do
  result=$(ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -o BatchMode=yes damion@$ip "hostname" 2>/dev/null)
  if [ $? -eq 0 ]; then echo "FOUND: $ip ($result)"; break; fi
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

### Sync Mac -> VM

```bash
# Full sync (excludes heavy build artifacts)
rsync -avz --progress \
  --exclude='node_modules' --exclude='.git' --exclude='dist' \
  --exclude='src-tauri/target' --exclude='*.db' \
  -e ssh /Users/damion/CODE/Recall_Rogue/ damion@<IP>:'C:\Users\damion\recall-rogue\'

# Quick sync (only changed source files)
rsync -avz --progress \
  --include='src/***' --include='src-tauri/***' --include='package.json' \
  --include='package-lock.json' --include='vite.config.ts' --include='tsconfig*.json' \
  --include='index.html' --include='public/***' \
  --exclude='src-tauri/target' --exclude='node_modules' --exclude='*' \
  -e ssh /Users/damion/CODE/Recall_Rogue/ damion@<IP>:'C:\Users\damion\recall-rogue\'
```

### Pull artifacts VM -> Mac

```bash
# Copy Windows exe back
scp damion@<IP>:'C:\Users\damion\recall-rogue\src-tauri\target\release\bundle\nsis\*.exe' /Users/damion/CODE/WINDOWS_VM/
```

## Windows Build Workflow

```bash
# 1. Sync latest code from Mac
rsync -avz --progress --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='src-tauri/target' --exclude='*.db' -e ssh /Users/damion/CODE/Recall_Rogue/ damion@<IP>:'C:\Users\damion\recall-rogue\'

# 2. Install/update npm deps (first time or after package.json changes)
ssh damion@<IP> "cd C:\Users\damion\recall-rogue && npm install"

# 3. Build Tauri Windows exe
ssh -o ServerAliveInterval=30 damion@<IP> "cd C:\Users\damion\recall-rogue && npm run steam:build 2>&1"

# 4. Copy artifact back to Mac
scp damion@<IP>:'C:\Users\damion\recall-rogue\src-tauri\target\release\bundle\nsis\*.exe' /Users/damion/CODE/WINDOWS_VM/

# 5. Test — launch dev server on VM
ssh damion@<IP> "cd C:\Users\damion\recall-rogue && npm run dev"
```

## Troubleshooting

- **VM not found on network:** Make sure UTM VM is running and set to Bridged networking
- **SSH timeout:** VM may be booting. Wait 30s and retry
- **winget source errors:** Run `winget source reset --force && winget source update` first
- **msstore certificate errors:** Always add `--source winget` to winget install commands
- **PATH not refreshed after install:** Prepend `$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User');` to PowerShell commands
- **Key auth fails:** Fix with `sshpass -p 'chrx' ssh damion@<IP> "powershell -Command \"Set-Content -Path 'C:\ProgramData\ssh\administrators_authorized_keys' -Value 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEH21agjJ+Rb9aCzEWOiXTSJj0C0QgVBvVr3yFan3muO mulda@IntelliDows'; icacls 'C:\ProgramData\ssh\administrators_authorized_keys' /inheritance:r /grant 'SYSTEM:(F)' /grant 'Administrators:(F)'; Restart-Service sshd\""
- **rsync backslash issues:** Use single quotes around Windows paths in rsync/scp commands

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
