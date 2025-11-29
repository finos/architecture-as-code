import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://your-domain.com',
  base: '/advent/',
  outDir: './dist',
  build: {
    format: 'directory'
  },
  trailingSlash: 'always'
});
