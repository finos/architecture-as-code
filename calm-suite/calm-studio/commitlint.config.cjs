// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'studio',
        'desktop',
        'calm-core',
        'calmscript',
        'mcp-server',
        'extensions',
        'ci',
        'docs',
        'deps',
        'github-action',
        'vscode-extension',
        'web-component',
      ],
    ],
  },
};
