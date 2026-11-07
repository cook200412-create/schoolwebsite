import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared'), '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.tsx'], include: ['test/**/*.test.{ts,tsx}'], css: false },
});
