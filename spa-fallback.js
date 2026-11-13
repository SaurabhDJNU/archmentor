// GitHub Pages has no server-side routing, so it needs a copy of index.html as 404.html.
// Cloudflare Pages and Vercel route single-page apps themselves, so this is skipped there.
import { copyFileSync, existsSync } from 'node:fs';

if (process.env.CF_PAGES || process.env.VERCEL) {
  console.log('spa-fallback: not needed on this host');
} else if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html');
  console.log('spa-fallback: wrote dist/404.html');
}
