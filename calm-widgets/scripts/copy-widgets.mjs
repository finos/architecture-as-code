import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src/widgets');
const outDirs = [
    path.join(projectRoot, 'dist/cli/widgets'), // For cli bundling
    path.join(projectRoot, 'dist/widgets') // For shared tests
];

function copyTemplatesRecursively(currentDir, baseDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(currentDir, entry.name);
        const relPath = path.relative(baseDir, srcPath);

        if (entry.isDirectory()) {
            copyTemplatesRecursively(srcPath, baseDir);
        } else if (entry.isFile()) {
            if (path.extname(entry.name) === '.ts') continue; // skip .ts files

            for (const outDir of outDirs) {
                const destPath = path.join(outDir, relPath);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}

for (const outDir of outDirs) {
    fs.mkdirSync(outDir, { recursive: true });
}
copyTemplatesRecursively(srcDir, srcDir);
