// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    loader: 'src/loader.ts',
    remark: 'src/remark.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['@calmstudio/diagram', '@calmstudio/diagram/render', 'react', 'react/jsx-runtime'],
});
