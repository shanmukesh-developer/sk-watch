import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    host: true,
    proxy: {
      '/peerjs': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '/relay': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '/ping': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
