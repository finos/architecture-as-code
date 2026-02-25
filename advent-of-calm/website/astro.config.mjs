import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://calm.finos.org',
  base: '/advent/',
  outDir: './dist',
  build: {
    format: 'directory'
  },
  trailingSlash: 'always'
});
