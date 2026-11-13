import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// The repository is flat (no folders), so the app files that must be served as-is
// (PWA manifest, service worker, offline page, icons) are copied into the build here.
const STATIC = ['manifest.webmanifest', 'sw.js', 'offline.html', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', '_headers'];
const copyStatic = () => ({
  name: 'copy-static',
  generateBundle() {
    for (const f of STATIC) {
      try { this.emitFile({ type: 'asset', fileName: f, source: readFileSync(f) }); } catch { /* optional file */ }
    }
  },
});

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/archmentor/"). On Cloudflare Pages / a custom domain it stays "/".
export default defineConfig({
  plugins: [react(), copyStatic()],
  base: process.env.BASE_PATH || '/',
  test: { environment: 'node', include: ['*.test.js'] },
});
