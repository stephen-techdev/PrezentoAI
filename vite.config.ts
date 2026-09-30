import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['html2canvas', 'jspdf'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          pptxgenjs: ['pptxgenjs'],
          jspdf: ['jspdf'],
          html2canvas: ['html2canvas'],
          chartjs: ['chart.js'],
        },
      },
    },
  },
});
