import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    https: {
      // Use your dev certificate here
      // key: fs.readFileSync('./certs/localhost-key.pem'),
      // cert: fs.readFileSync('./certs/localhost.pem'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          teams: ['@microsoft/teams-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
