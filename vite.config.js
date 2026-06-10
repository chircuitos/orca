import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/orca/',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
});
