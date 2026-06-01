import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'icon.svg'],
        manifest: {
          name: 'Harbour Finance',
          short_name: 'Harbour',
          description: 'Progressive Web App for tracking Caribbean equities',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '.',
          icons: [
            {
              src: 'icon.svg',
              type: 'image/svg+xml',
              sizes: 'any',
            },
            {
              src: 'icon.svg',
              type: 'image/svg+xml',
              sizes: '192x192',
              purpose: 'any maskable',
            },
            {
              src: 'icon.svg',
              type: 'image/svg+xml',
              sizes: '512x512',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
