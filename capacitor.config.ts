import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android prototype shell. The app is the production web build loaded from Vercel, so web fixes reach the phone
 * without a new APK; only the native plugins (background GPS, native speech) live in the shell.
 * For a store release, bundle `dist/` instead (remove `server`) and point the API calls at an absolute URL.
 */
const config: CapacitorConfig = {
  appId: 'pk.buraq.app',
  appName: 'Buraq Pakistan',
  webDir: 'dist',
  server: {
    url: 'https://rasta-sahilx.vercel.app',
    cleartext: false
  },
  android: { allowMixedContent: false, useLegacyBridge: true } // legacy bridge: keeps background GPS alive past 5 min
};

export default config;
