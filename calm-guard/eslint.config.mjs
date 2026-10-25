import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'docs/**',
    'scripts/**',
    '.planning/**',
  ]),
  ...nextVitals,
  {
    rules: {
      'object-curly-spacing': ['error', 'always'],
      // React Compiler rules from eslint-plugin-react-hooks 7. Existing code does not conform yet.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
]);
