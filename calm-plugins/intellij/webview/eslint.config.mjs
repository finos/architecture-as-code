import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
export default [{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } },
  plugins: { '@typescript-eslint': typescript },
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
}];
