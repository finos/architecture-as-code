// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from '@docusaurus/types';

/**
 * Docusaurus plugin: routes *.calm.json imports through the pre-rendering
 * webpack loader and injects the CalmDiagram stylesheet.
 *
 * The loader and stylesheet are referenced as package subpaths (resolved by
 * webpack's enhanced-resolve against this package's `exports` map) so this
 * entry needs no Node built-ins and stays safe to import from MDX.
 *
 * Note: the remark plugin (`@calmstudio/docusaurus-plugin/remark`) must be
 * registered separately via `beforeDefaultRemarkPlugins` in the preset
 * config — Docusaurus has no API for one plugin to extend another plugin's
 * remark chain. See README.
 */
export default function calmstudioDocusaurusPlugin(): Plugin<void> {
  return {
    name: '@calmstudio/docusaurus-plugin',
    configureWebpack() {
      return {
        module: {
          rules: [
            {
              test: /\.calm\.json$/,
              type: 'javascript/auto',
              use: '@calmstudio/docusaurus-plugin/loader',
            },
          ],
        },
      };
    },
    getClientModules() {
      return ['@calmstudio/docusaurus-plugin/styles.css'];
    },
  };
}
