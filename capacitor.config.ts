import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.b2933d1e2ef944818568712130ce8430',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://b2933d1e-2ef9-4481-8568-712130ce8430.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
  },
};

export default config;
