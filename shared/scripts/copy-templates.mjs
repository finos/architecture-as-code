import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const projectRoot = path.resolve(__dirname, '..');

// Template bundles to copy
const bundles = [
    { src: 'src/docify/template-bundles/docusaurus', dest: 'dist/template-bundles/docusaurus', exclude: null },
];

function copyRecursive(currentDir, baseDir, outDir, excludedFile) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, srcPath);
        const destPath = path.join(outDir, relPath);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, baseDir, outDir, excludedFile);
        } else if (entry.isFile() && entry.name !== excludedFile && !entry.name.endsWith('.spec.ts')) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

for (const bundle of bundles) {
    const srcDir = path.join(projectRoot, bundle.src);
    const outDir = path.join(projectRoot, bundle.dest);

    if (fs.existsSync(srcDir)) {
        fs.mkdirSync(outDir, { recursive: true });
        copyRecursive(srcDir, srcDir, outDir, bundle.exclude);
    }
}
