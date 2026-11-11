import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    packs: 'src/packs/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['@finos/calm-models'],
});
