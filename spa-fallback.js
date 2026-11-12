// GitHub Pages has no server-side routing. Copying index.html to 404.html
// lets deep links like /mentors/abc load the app, which then routes itself.
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html');
  console.log('spa-fallback: wrote dist/404.html');
}
