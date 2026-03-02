import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('node_modules/@eslint/eslintrc/lib/config-array/override-tester.js');
const expected = 'import minimatch from "minimatch";';
const replacement = 'import { minimatch } from "minimatch";';

if (!fs.existsSync(filePath)) {
    throw new Error(`Expected ESLint override tester at ${filePath}`);
}

const source = fs.readFileSync(filePath, 'utf8');

if (source.includes(replacement)) {
    console.log('eslint minimatch patch already applied');
    process.exit(0);
}

if (!source.includes(expected)) {
    throw new Error('Expected ESLint minimatch import pattern not found');
}

fs.writeFileSync(filePath, source.replace(expected, replacement));
console.log('patched @eslint/eslintrc minimatch import for minimatch v10');
