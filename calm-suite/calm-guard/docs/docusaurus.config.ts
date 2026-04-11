import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'CALMGuard',
  tagline: 'CALM-native continuous compliance for financial services',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://finos-labs.github.io',
  baseUrl: '/dtcch-2026-opsflow-llc/',

  organizationName: 'finos-labs',
  projectName: 'dtcch-2026-opsflow-llc',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'CALMGuard',
      logo: {
        alt: 'CALMGuard Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/finos-labs/dtcch-2026-opsflow-llc',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/getting-started',
            },
            {
              label: 'Architecture Overview',
              to: '/architecture/system-overview',
            },
            {
              label: 'API Reference',
              to: '/api/reference',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'FINOS',
              href: 'https://www.finos.org',
            },
            {
              label: 'CALM Spec',
              href: 'https://github.com/finos/architecture-as-code',
            },
            {
              label: 'DTCC Hackathon',
              href: 'https://innovate.dtcc.com',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/finos-labs/dtcch-2026-opsflow-llc',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} CALMGuard — Built for DTCC/FINOS Innovate Hackathon 2026. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'typescript'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
