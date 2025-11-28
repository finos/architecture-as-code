import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://your-domain.com',
  base: '/',
  outDir: './dist',
  build: {
    format: 'directory'
  }
});
