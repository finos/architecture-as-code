import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', '**/*.vsix'] },
    {
        rules: {
            'object-curly-spacing': ['error', 'always'],
        },
    },
    {
        // Webview (React) sources — browser environment.
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['src/webview/**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // The canvas transforms lean on `any` for the loosely-typed CALM JSON.
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // Extension host sources — Node environment.
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['src/extension/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.node,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    {
        // Test files + the vscode mock use both environments and TS syntax.
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.ts'],
        languageOptions: {
            globals: { ...globals.node, ...globals.browser },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    }
);
