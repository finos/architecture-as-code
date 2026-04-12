// SPDX-FileCopyrightText: 2024 FINOS CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'CalmStudio',
  tagline: 'Visual CALM architecture editor — draw diagrams, get validated code',
  favicon: 'img/favicon.ico',

  url: 'https://finos.github.io',
  baseUrl: '/calmstudio/',

  organizationName: 'finos',
  projectName: 'calmstudio',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../packages/calm-core/src/index.ts'],
        tsconfig: '../packages/calm-core/tsconfig.json',
        out: 'docs/api',
        sidebar: {
          autoConfiguration: true,
          pretty: true,
        },
        excludePrivate: true,
        excludeProtected: false,
        hideGenerator: true,
        readme: 'none',
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/finos/calmstudio/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/calmstudio-social-card.png',
    navbar: {
      title: 'CalmStudio',
      logo: {
        alt: 'FINOS Logo',
        src: 'img/finos-logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/api/',
          position: 'left',
          label: 'API Reference',
          activeBasePath: '/docs/api',
        },
        {
          href: 'https://github.com/finos/calmstudio',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/quick-start',
            },
            {
              label: 'Developer Guide',
              to: '/docs/developer-guide/extension-packs',
            },
          ],
        },
        {
          title: 'FINOS Ecosystem',
          items: [
            {
              label: 'CALM Specification',
              href: 'https://calm.finos.org/release/1.2/',
            },
            {
              label: 'AIGF',
              href: 'https://air-governance-framework.finos.org/',
            },
            {
              label: 'architecture-as-code',
              href: 'https://github.com/finos/architecture-as-code',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/finos/calmstudio',
            },
            {
              label: 'FINOS',
              href: 'https://finos.org',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} FINOS CalmStudio Contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'json', 'bash'],
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
