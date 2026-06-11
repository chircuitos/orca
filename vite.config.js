import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const d = new Date();
const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const buildDate = `${String(d.getDate()).padStart(2,'0')}/${months[d.getMonth()]}/${d.getFullYear()}`;

export default defineConfig({
  root: 'src',
  base: '/orca/',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'inject-version',
      transformIndexHtml(html) {
        return html
          .replace('__APP_VERSION__', pkg.version.replace(/\.\d+$/, ''))
          .replace('__BUILD_DATE__', buildDate);
      },
    },
  ],
});
