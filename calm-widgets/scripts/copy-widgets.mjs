#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const srcDir = path.join(projectRoot, 'widgets');
const outDir = path.join(projectRoot, 'dist/widgets');

function copyRecursively(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`Source directory ${src} does not exist, skipping copy.`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursively(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied: ${entry.name}`);
        }
    }
}

console.log('Copying widget templates...');
copyRecursively(srcDir, outDir);
console.log('Widget templates copied successfully!');
