import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.terragacha.app',
  appName: 'Recall Rogue',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Live reload: point Android WebView at Mac's Vite dev server via adb reverse
    url: 'http://localhost:5173',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,          // manual hide after game loads
      launchShowDuration: 0,          // no auto-hide timer
      backgroundColor: '#0a0e1a',     // dark space blue (existing)
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e1a',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
    Haptics: {
      // Capacitor Haptics plugin — iOS UIImpactFeedbackGenerator
      // No configuration needed; plugin is used via hapticService.ts
    },
  }
};

export default config;
