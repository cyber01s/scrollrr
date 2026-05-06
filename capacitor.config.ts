import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.scrollrr.app',
  appName: 'Scrollrr',
  webDir: 'out',
  server: {
    url: 'https://scrollrr.vercel.app',
    cleartext: true
  }
};

export default config;
