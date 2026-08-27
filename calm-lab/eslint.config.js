import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'coverage'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        },
    },
    {
        // The lab components moved over from the docs site are plain JS/JSX; the TypeScript-aware
        // unused-vars rule does not apply to them, and only ESLint can check their JSX — there is
        // no `checkJs`, so nothing else looks at them at all.
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: { react },
        settings: { react: { version: 'detect' } },
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            // These components take plain CALM/lesson objects; TypeScript covers the new modules
            // and prop-types would only add ceremony to the ported ones.
            'react/prop-types': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'error',
        },
    }
);
