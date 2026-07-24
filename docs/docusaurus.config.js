// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
import remarkSectionCallouts from './src/plugins/remark-section-callouts.js';

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Architecture as Code',
    tagline: 'Don\'t let your architecture get lost on a whiteboard',
    favicon: 'img/favicon.ico',

    // Set the production url of your site here
    url: 'https://calm.finos.org/',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'finos', // Usually your GitHub org/user name.
    projectName: 'architecture-as-code', // Usually your repo name.

    onBrokenLinks: 'throw',

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    markdown: {
        hooks: {
            onBrokenMarkdownLinks: 'warn'
        }
    },

    headTags: [
        {
            tagName: 'link',
            attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'},
        },
        {
            tagName: 'link',
            attributes: {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous'},
        },
    ],

    stylesheets: [
        'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
    ],

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    routeBasePath: '/',
                    sidebarPath: './sidebars.js',
                    // Runs before Docusaurus' own heading/TOC plugins so the
                    // headings it replaces with callouts never reach the page
                    // TOC. Deliberately not applied to the 'talks' plugin.
                    beforeDefaultRemarkPlugins: [remarkSectionCallouts],
                },
                blog: false,
                theme: {
                    customCss: ['./src/css/custom.css', './src/css/doc-pages.css'],
                },
            }),
        ],
    ],

    themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            // Replace with your project's social card
            image: 'img/docusaurus-social-card.jpg',
            navbar: {
                title: 'CALM',
                logo: {
                    alt: 'CALM Logo',
                    src: 'img/2025_CALM_Icon.svg',
                },
                items: [
                    {
                        to: '/learn',
                        label: 'Learn',
                        position: 'left',
                        activeBaseRegex: '/(learn|tutorials)(/|$)',
                    },
                    {
                        to: '/reference',
                        label: 'Reference',
                        position: 'left',
                        activeBaseRegex: '/(reference|core-concepts|introduction)(/|$)',
                    },
                    {
                        to: '/tools',
                        label: 'Tools',
                        position: 'left',
                        activeBaseRegex: '/(tools|working-with-calm|calm-hub)(/|$)',
                    },
                    {
                        to: '/community',
                        label: 'Community',
                        position: 'left',
                        activeBaseRegex: '/community(/|$)',
                    },
                    {
                        href: 'https://hub.calm.finos.org/',
                        label: 'Hub',
                        position: 'right',
                    },
                    {
                        href: 'https://github.com/finos/architecture-as-code',
                        label: 'GitHub',
                        position: 'right',
                    },
                    {
                        to: '/learn',
                        label: 'Get started',
                        position: 'right',
                        className: 'calm-navbar-cta',
                    },
                ],
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'CALM',
                        items: [
                            {
                                label: 'Schema',
                                href: 'http://github.com/finos/architecture-as-code/blob/master/calm/',
                            },
                            {
                                label: 'CALM Hub',
                                href: 'https://hub.calm.finos.org/',
                            },
                        ],
                    },
                    {
                        title: 'Community',
                        items: [
                            {
                                label: 'Find an Issue',
                                href: 'https://github.com/finos/architecture-as-code/issues',
                            },
                            {
                                label: 'Feature Request',
                                href: 'https://github.com/finos/architecture-as-code/issues/new?assignees=&labels=&projects=&template=Feature_request.md',
                            },
                            {
                                label: 'Bug Report',
                                href: 'https://github.com/finos/architecture-as-code/issues/new?assignees=&labels=&projects=&template=Bug_report.md',
                            },
                            {
                                label: 'Talks',
                                to: '/talks/',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/finos/architecture-as-code',
                            },
                        ],
                    },
                ],
                copyright: `Copyright © ${new Date().getFullYear()} DevOps Automation - FINOS`,
            },
            prism: {
                theme: prismThemes.github,
                darkTheme: prismThemes.dracula,
                additionalLanguages: ['typescript', 'json', 'bash'],
            },
            algolia: {
                // The application ID provided by Algolia
                appId: '87IS6TKJAE',

                // Public API key: it is safe to commit it
                apiKey: 'dfdc380d6e179c38f558cb610645257a',

                indexName: 'calm-finos',

                // Optional: see doc section below
                contextualSearch: true,

                // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites
                // externalUrlRegex: 'external\\.com|domain\\.com',

                // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
                // replaceSearchResultPathname: {
                //   from: '/docs/', // or as RegExp: /\/docs\//
                //   to: '/',
                // },

                // Optional: Algolia search parameters
                searchParameters: {},

                // Optional: path for search page that enabled by default (`false` to disable it)
                searchPagePath: 'search',

                // Optional: whether the insights feature is enabled or not on Docsearch (`false` by default)
                // insights: false,
            },
        }),
};

export default config;
