---
name: android-deploy
description: Build and deploy the Android debug APK for live reload development on a USB-connected phone. Run this after native config changes or when setting up a new phone.
user_invocable: true
---

# ⛔⛔⛔ MANDATORY: AR PHASE DOC REQUIRED ⛔⛔⛔
#
# STOP. DO NOT WRITE CODE. DO NOT DELEGATE TO SUB-AGENTS. DO NOT EDIT FILES.
#
# Before doing ANY work that is not a trivial 2-minute single-line fix:
# 1. Check `docs/roadmap/phases/` and `docs/roadmap/completed/` for the next AR number
# 2. CREATE an AR phase doc: `docs/roadmap/phases/AR-NN-SHORT-NAME.md`
#    - Must contain: Overview, numbered TODO checklist, acceptance criteria, files affected
# 3. Present the AR doc to the user for review
# 4. ONLY THEN begin implementation, checking off TODOs as you go
# 5. When done: move the doc to `docs/roadmap/completed/`
#
# NO EXCEPTIONS. "Let me just quickly..." is NOT an exception.
# "It's a small change" with more than 3 steps is NOT an exception.
# Content pipeline batches are NOT an exception.
# Multi-file refactors are NOT an exception.
#
# If you skip this step, the user WILL make you redo the work.
# ⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔

# Android Deploy — Live Reload APK

Builds a debug APK on the remote server and provides instructions for the local MacBook agent to install it on a USB-connected Android phone.

## Architecture

```
Phone (Recall Rogue APK)
  → localhost:5173 (adb reverse)
  → MacBook:5173 (SSH tunnel)
  → Remote server Vite dev server
```

- The APK contains all static assets (sprites, backgrounds, cardbacks) locally on-device for fast loading
- JS/CSS/HTML loads from the Vite dev server via the tunnel chain above
- HMR (hot module replacement) pushes code changes live to the phone
- `capacitor.config.ts` has `server.url: 'http://localhost:5173'` and `cleartext: true` for this to work

## When to Rebuild the APK

Only rebuild when:
- `capacitor.config.ts` changes (server settings, plugin config)
- Capacitor plugins are added/removed
- `AndroidManifest.xml` changes
- Static assets change significantly (new sprites, backgrounds)
- Native Java code changes

Do NOT rebuild for:
- Svelte component changes (live reload handles this)
- TypeScript/JS code changes (live reload handles this)
- CSS/style changes (live reload handles this)
- Balance/data file changes (live reload handles this)

## Remote Server Steps (run by Claude Code on the server)

```bash
# 1. Build web assets
npm run build

# 2. Sync to Android project
npx cap sync android

# 3. Build debug APK (requires JDK 21 + Android SDK)
export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd android && ./gradlew assembleDebug && cd ..

# APK output: android/app/build/outputs/apk/debug/app-debug.apk (~106MB)
```

## MacBook Steps (run by user or local Claude Code agent)

### One-time setup
```bash
# Ensure SSH tunnel is running (keep this terminal open)
ssh -L 5173:localhost:5173 root@<SERVER_IP>

# Set up ADB reverse port (re-run if phone disconnects)
adb reverse tcp:5173 tcp:5173
```

### Install/update the APK
```bash
# Pull APK from remote server
scp root@<SERVER_IP>:/root/terra-miner/android/app/build/outputs/apk/debug/app-debug.apk ~/Desktop/app-debug.apk

# Install on connected phone (-r = replace existing)
adb install -r ~/Desktop/app-debug.apk
```

### After install
- Open the "Recall Rogue" app on the phone
- It loads the native shell locally (fast) with assets from the APK
- Code/JS streams live from the Vite dev server — changes appear instantly
- If the app shows a blank/white screen, check:
  1. SSH tunnel is running
  2. `adb reverse tcp:5173 tcp:5173` is set
  3. Vite dev server is running on remote (`npm run dev`)

## Prerequisites

### Remote server (already installed)
- JDK 21: `/usr/lib/jvm/java-21-openjdk-amd64`
- Android SDK: `/opt/android-sdk` (platform 35, build-tools 35.0.0)
- Android cmdline-tools: `/opt/android-sdk/cmdline-tools/latest/`

### MacBook
- `adb` (Android Debug Bridge) — comes with Android Studio or `brew install android-platform-tools`
- USB debugging enabled on the Android phone
- SSH access to the remote server

## Key Files
- `capacitor.config.ts` — server URL and cleartext settings
- `android/app/src/main/AndroidManifest.xml` — `usesCleartextTraffic="true"`
- `android/app/build/outputs/apk/debug/app-debug.apk` — the output
