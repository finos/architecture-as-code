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
    url: 'https://your-docusaurus-site.example.com',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'finos-labs', // Usually your GitHub org/user name.
    projectName: 'architecture-as-code', // Usually your repo name.

    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',

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
                id: 'manifest',
                path: 'manifest',
                routeBasePath: 'manifest',
                sidebarPath: require.resolve('./sidebars.js'),
            },
        ],
        [
            '@docusaurus/plugin-content-docs',
            {
                id: 'community',
                path: 'community',
                routeBasePath: 'community',
                sidebarPath: require.resolve('./sidebars.js'),
            },
        ],
    ],

    themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            // Replace with your project's social card
            image: 'img/docusaurus-social-card.jpg',
            navbar: {
                title: 'Architecture as Code',
                logo: {
                    alt: 'Architecture as Code Logo',
                    src: 'img/logo.svg',
                },
                items: [
                    {
                        type: 'docSidebar',
                        sidebarId: 'docsSidebar',
                        position: 'left',
                        label: 'Docs',
                    },
                    {
                        to: '/manifest/',
                        label: 'Manifest',
                        position: 'left',
                        activeBaseRegex: `/manifest/`,
                    },
                    {
                        to: '/community/',
                        label: 'Community',
                        position: 'left',
                        activeBaseRegex: `/community/`,
                    },
                    {
                        href: 'https://github.com/finos-labs/architecture-as-code',
                        label: 'GitHub',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'dark',
                links: [
                    {
                        title: 'Manifest',
                        items: [
                            {
                                label: 'Core',
                                href: 'http://github.com/finos-labs/architecture-as-code/blob/master/manifest/',
                            },
                        ],
                    },
                    {
                        title: 'Community',
                        items: [
                            {
                                label: 'Find an Issue',
                                href: 'https://github.com/finos-labs/architecture-as-code/issues',
                            },
                            {
                                label: 'Feature Request',
                                href: 'https://github.com/finos-labs/architecture-as-code/issues/new?assignees=&labels=&projects=&template=Feature_request.md',
                            },
                            {
                                label: 'Bug Report',
                                href: 'https://github.com/finos-labs/architecture-as-code/issues/new?assignees=&labels=&projects=&template=Bug_report.md',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'Working Group',
                                href: 'https://devops.finos.org/docs/working-groups/aasc/',
                            },
                            {
                                label: 'GitHub',
                                href: 'https://github.com/finos-labs/architecture-as-code',
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
        }),
};

export default config;
