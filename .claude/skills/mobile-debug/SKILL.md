---
name: mobile-debug
description: |
  [POST-STEAM] Capacitor mobile debugging guide. Chrome remote inspection, Inspect.dev, WebDebugX, native profiler workflows, and dev diagnostics panel spec. Suggest only after mobile work resumes post-Steam launch.
user_invocable: true
status: post-steam
---

> **Status — Post-Steam launch (2026-04-10).** Mobile ships after Steam. The orchestrator must NOT proactively suggest this skill until mobile work resumes; keep it on-demand only.

# Mobile Debugging — Capacitor + Phaser

## When to Use

- When something works in browser but breaks on mobile
- When performance is poor on a specific device
- When touch interactions behave differently than expected
- When investigating WebView rendering quirks
- **PROACTIVE TRIGGER**: Any mention of mobile bugs, device testing, or "works on desktop but not phone"

## Quick Start: Android Remote Debugging

1. **Enable USB debugging** on Android device (Settings > Developer Options > USB Debugging)
2. **Connect device via USB** to development machine
3. **Open Chrome** on desktop, navigate to `chrome://inspect`
4. Device and app WebView should appear in the list
5. Click **"inspect"** under the app — full Chrome DevTools opens
6. You now have: Console, Network, Elements, Performance profiler — all running against the live app

## Quick Start: iOS Remote Debugging

1. **Enable Web Inspector** on iOS (Settings > Safari > Advanced > Web Inspector)
2. **Connect device via USB** to Mac
3. **Open Safari** on Mac, go to Develop menu
4. Select the connected device and the WebView
5. Full Safari Web Inspector opens with console, network, elements

## Advanced Tools

### Inspect.dev
Cross-platform WebView debugger. Works on Windows/Mac/Linux for both iOS and Android.
- Install from [inspect.dev](https://inspect.dev)
- Provides Chrome DevTools-like experience without platform-specific setup
- Supports network monitoring, DOM inspection, console

### WebDebugX
Remote debugging tool for iOS/Android WebViews from any OS.
- [webdebugx.com](https://www.webdebugx.com/en/)
- Real-time debugging, network monitoring, performance profiling

## Performance Profiling

### Android
- Open **Android Studio Profiler** (View > Tool Windows > Profiler)
- CPU: Time Profiler shows where time is spent
- Memory: Allocations tracker shows memory pressure
- Network: Monitor API calls and asset loading

### iOS
- Open **Xcode Instruments** (Product > Profile)
- Time Profiler: CPU bottlenecks
- Allocations: Memory leaks and pressure
- Core Animation: Rendering performance (FPS)

### In-App Diagnostics
Add a dev diagnostics panel that shows:
- `Capacitor.isNativePlatform()` — confirms native vs web
- `navigator.userAgent` — WebView version
- FPS counter (Phaser's `game.loop.actualFps`)
- GPU info via `WEBGL_debug_renderer_info` extension
- Screen dimensions and pixel ratio
- Available memory (`performance.memory` on Android)

## Common Mobile Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Canvas blank on older Android | WebGL context lost | Fall back to Canvas renderer |
| Touch events not registering | Phaser input zone occluded by DOM | Check z-index, pointer-events |
| Slow FPS on low-end devices | WebGL overhead | Switch to Canvas renderer (30% FPS gain) |
| Audio not playing | Mobile browsers require user gesture | Play silent audio on first tap |
| Safe area overlap | Notch/nav bar covering content | Use `env(safe-area-inset-*)` CSS |
| Keyboard pushing layout | Soft keyboard resizes WebView | Use `Keyboard.setResizeMode('none')` |

## Capacitor-Specific Commands

```bash
# Build and sync to native project
npm run build && npx cap sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios

# Live reload on device
npx cap run android --livereload --external
npx cap run ios --livereload --external
```

## References

- [Capacitor Debugging Docs](https://capacitorjs.com/docs/v5/vscode/debugging)
- [Inspect.dev Capacitor Guide](https://inspect.dev/guides/debug-ionic-capacitor)
- [Phaser + Capacitor Tutorial](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor)
