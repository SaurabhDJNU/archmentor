import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/archmentor/").
// On Vercel, Netlify or a custom domain it stays "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
});
