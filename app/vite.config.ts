import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import info from '../server/src/serverInfo.json';

const isDemoMode = process.env.VITE_ENV === 'demo';
const isProdMode = process.env.VITE_ENV === 'prod';
// The Sentry Vite plugin walks every chunk to inject release IDs and tries to
// upload sourcemaps. Without an auth token it logs two warnings per build and
// does no useful work — gate it on the token being present so self-hosters
// (the common case) get a quiet build.
const hasSentryAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

const plugins = [react(), tsconfigPaths()];

if (isProdMode && hasSentryAuth) {
  plugins.push(sentryVitePlugin({
    org: 'free-sleep',
    project: 'app',
    release: {
      name: info.version,
    }
  }));
}

export default defineConfig({
  plugins,
  server: {
    host: '0.0.0.0', // This makes the server accessible to other devices on the network
    port: 5173, // Optional: specify a port if you want something other than the default
  },
  build: {
    sourcemap: !isDemoMode,
    outDir: isDemoMode ? './dist/' : '../server/public/',
    // mui-vendor and date-vendor (moment-timezone) are intentionally large —
    // they're long-lived browser caches that change rarely. The actual user-
    // facing bundle is the entry chunk + active route, which are both small.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: 'index.js', // Set the name for the JS entry file
        chunkFileNames: '[name]-[hash].js', // Names for dynamic imports
        assetFileNames: ({ name }) => {
          if (name?.endsWith('.css')) {
            return 'index.css';
          }
          return '[name]-[hash].[ext]';
        },
        // Split big vendors so they cache independently across deploys.
        //
        // IMPORTANT: keep @mui/material and @mui/x-charts in the SAME chunk.
        // x-charts internally re-exports from @mui/material, and splitting
        // them creates a circular import between the two output chunks
        // (mui-vendor ↔ charts-vendor) which Rollup cannot resolve cleanly:
        // the browser hits a TDZ "Cannot access 'as' before initialization"
        // on first load and the whole app fails to mount (white page).
        // Bundling them together is the simplest fix; the combined chunk is
        // ~700KB but only loads once and caches forever.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('node_modules/@mui/') ||
            id.includes('node_modules/@emotion/') ||
            id.includes('node_modules/d3')
          ) return 'mui-vendor';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) return 'react-vendor';
          if (
            id.includes('node_modules/moment') ||
            id.includes('node_modules/date-fns')
          ) return 'date-vendor';
          return undefined;
        },
      },
    },
  },
});
