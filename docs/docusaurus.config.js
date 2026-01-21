// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

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
    markdown: {
        hooks: {
            onBrokenMarkdownLinks: 'warn'
        }
    },

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    routeBasePath: '/',
                    sidebarPath: './sidebars.js',
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            }),
        ],
    ],

    plugins: [
        [
            '@docusaurus/plugin-content-docs',
            {
                id: 'talks',
                path: 'talks',
                routeBasePath: 'talks',
                sidebarPath: require.resolve('./talksSidebar.js'),
            },
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
                        type: 'docSidebar',
                        sidebarId: 'learningSidebar',
                        label: '📚 Learning',
                        position: 'left',
                    },
                    {
                        to: '/talks/',
                        label: '🎤 Talks',
                        position: 'left',
                        activeBaseRegex: `/talks/`,
                    },
                    {
                        href: 'https://github.com/finos/architecture-as-code',
                        label: 'GitHub',
                        position: 'right',
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
            },
            algolia: {
                // The application ID provided by Algolia
                appId: 'YOUR_APP_ID',

                // Public API key: it is safe to commit it
                apiKey: 'YOUR_SEARCH_API_KEY',

                indexName: 'calm_finos',

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
