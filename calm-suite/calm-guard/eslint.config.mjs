import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'docs/**',
      'scripts/**',
      '.planning/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
];

export default config;
