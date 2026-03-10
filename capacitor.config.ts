import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.terragacha.app',
  appName: 'Recall Rogue',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
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
      overlaysWebView: true,          // allows game canvas to render under status bar
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
