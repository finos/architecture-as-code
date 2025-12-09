/* eslint-disable no-undef */
module.exports = {
    title: 'My Docusaurus Docs',
    tagline: 'Generated documentation from CALM',
    url: 'http://localhost',
    baseUrl: '/',
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'warn',
    favicon: 'img/favicon.ico',
    organizationName: 'my-org',
    projectName: 'calm-docs',

    themeConfig: {
        navbar: {
            title: 'CALM Documentation',
            logo: {
                alt: 'Calm Logo',
                src: 'img/2025_CALM_Icon.svg',
            },
        },
    },

    themes: [
        '@docusaurus/theme-mermaid',
    ],
    markdown: {
        mermaid: true
    },
    stylesheets: [
        '/css/custom.css'
    ],
    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: require.resolve('./sidebars.js'),
                    routeBasePath: '/'
                },
            },
        ],
    ],
    plugins: [
        [
            require.resolve('docusaurus-plugin-search-local'),
            {
                indexDocs: true,
                indexPages: true,
                highlightSearchTermsOnTargetPage: true,
                removeDefaultStopWordFilter: true
            },
        ],
    ],
};
