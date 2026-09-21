import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'VentaPOS',
        short_name: 'VentaPOS',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f766e',
        icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  server: { port: 5173 },
});
