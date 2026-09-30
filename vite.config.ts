import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/solitaire/ on GitHub Pages.
export default defineConfig({
  base: '/solitaire/',
  plugins: [react()],
});
