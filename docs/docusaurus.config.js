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
    url: 'https://rocketstack-matt.github.io/',
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: '/architecture-as-code/',

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: 'finos', // Usually your GitHub org/user name.
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
        // [
        //     '@docusaurus/plugin-content-docs',
        //     {
        //         id: 'calm',
        //         path: 'calm',
        //         routeBasePath: 'calm',
        //         sidebarPath: require.resolve('./sidebars.js'),
        //     },
        // ],
        // [
        //     '@docusaurus/plugin-content-docs',
        //     {
        //         id: 'community',
        //         path: 'community',
        //         routeBasePath: 'community',
        //         sidebarPath: require.resolve('./sidebars.js'),
        //     },
        // ],
        [
            '@docusaurus/plugin-content-docs',
            {
                id: 'talks',
                path: 'talks',
                routeBasePath: 'talks',
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
                title: 'CALM',
                logo: {
                    alt: 'CALM Logo',
                    src: 'img/logo.svg',
                },
                items: [
                    // {
                    //     type: 'docSidebar',
                    //     sidebarId: 'docsSidebar',
                    //     position: 'left',
                    //     label: 'Docs',
                    // },
                    // {
                    //     to: '/calm/',
                    //     label: 'CALM',
                    //     position: 'left',
                    //     activeBaseRegex: `/calm/`,
                    // },
                    // {
                    //     to: '/community/',
                    //     label: 'Community',
                    //     position: 'left',
                    //     activeBaseRegex: `/community/`,
                    // },
                    {
                        to: '/talks/',
                        label: 'Talks',
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
                                label: 'Working Group',
                                href: 'https://devops.finos.org/docs/working-groups/aasc/',
                            },
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
        }),
};

export default config;
