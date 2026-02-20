import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const rootDir = path.resolve(__dirname, '..');
    const rootEnv = loadEnv(mode, rootDir, '');
    const appEnv = loadEnv(mode, __dirname, '');
    const env = { ...rootEnv, ...appEnv };
    return {
      base: '/embed/frame-variator/',
      server: {
        port: 5177,
        host: '0.0.0.0',
      },
      build: {
        outDir: path.resolve(__dirname, '../hub/public/embed/frame-variator'),
        emptyOutDir: true,
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.API_KEY ?? ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? env.API_KEY ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
