import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://aimilltest-dbd6dvhdcceef3d4.westus2-01.azurewebsites.net',
        changeOrigin: true,
      },
    },
  },
});
