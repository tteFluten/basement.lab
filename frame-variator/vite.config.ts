import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const rootDir = path.resolve(__dirname, '..');
    const env = { ...loadEnv(mode, rootDir, ''), ...loadEnv(mode, __dirname, '') };
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
        // Production build (embed): no key in bundle; app uses Hub API. Dev: use env for standalone.
        'process.env.API_KEY': JSON.stringify(mode === 'production' ? '' : (env.GEMINI_API_KEY ?? env.API_KEY ?? '')),
        'process.env.GEMINI_API_KEY': JSON.stringify(mode === 'production' ? '' : (env.GEMINI_API_KEY ?? env.API_KEY ?? ''))
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
