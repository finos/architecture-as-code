import { defineConfig } from 'tsup';

export default defineConfig({
    entry: [
        'src/docify/template-bundles/docusaurus/docusaurus-transformer.ts'
    ],
    format: ['esm'],
    clean: true,
    keepNames: true,
    noExternal: ['@finos/calm-widgets', /tsup/],
    outDir: 'dist/template-bundles/docusaurus',
    target: 'node18',
    outExtension: () => ({ js: '.js' })
});
