import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src/docify/template-bundles/docusaurus');
const outDir = path.join(projectRoot, 'dist/template-bundles/docusaurus');
const excludedFile = 'docusaurus-transformer.ts';

function copyRecursive(currentDir, baseDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, srcPath);
        const destPath = path.join(outDir, relPath);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, baseDir);
        } else if (entry.isFile() && entry.name !== excludedFile) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

fs.mkdirSync(outDir, { recursive: true });
copyRecursive(srcDir, srcDir);
