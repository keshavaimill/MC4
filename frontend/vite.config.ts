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
        target: 'https://mc4-forecasting-backend-hne0aufgdqdhf6a4.westus2-01.azurewebsites.net',
        changeOrigin: true,
      },
    },
  },
});
