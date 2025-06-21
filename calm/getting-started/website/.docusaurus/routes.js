import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
    {
        path: '/__docusaurus/debug',
        component: ComponentCreator('/__docusaurus/debug', '5ff'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/config',
        component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/content',
        component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/globalData',
        component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/metadata',
        component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/registry',
        component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
        exact: true
    },
    {
        path: '/__docusaurus/debug/routes',
        component: ComponentCreator('/__docusaurus/debug/routes', '000'),
        exact: true
    },
    {
        path: '/search',
        component: ComponentCreator('/search', '044'),
        exact: true
    },
    {
        path: '/',
        component: ComponentCreator('/', '78f'),
        routes: [
            {
                path: '/',
                component: ComponentCreator('/', '321'),
                routes: [
                    {
                        path: '/',
                        component: ComponentCreator('/', '254'),
                        routes: [
                            {
                                path: '/control-requirements/micro-segmentation.requirement.json',
                                component: ComponentCreator('/control-requirements/micro-segmentation.requirement.json', 'c60'),
                                exact: true
                            },
                            {
                                path: '/control-requirements/permitted-connection.requirement.json',
                                component: ComponentCreator('/control-requirements/permitted-connection.requirement.json', '080'),
                                exact: true
                            },
                            {
                                path: '/controls/security-001',
                                component: ComponentCreator('/controls/security-001', '869'),
                                exact: true
                            },
                            {
                                path: '/controls/security-002',
                                component: ComponentCreator('/controls/security-002', 'e5f'),
                                exact: true
                            },
                            {
                                path: '/controls/security-003',
                                component: ComponentCreator('/controls/security-003', '470'),
                                exact: true
                            },
                            {
                                path: '/nodes/attendees',
                                component: ComponentCreator('/nodes/attendees', '8cf'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/nodes/attendees-store',
                                component: ComponentCreator('/nodes/attendees-store', '748'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/nodes/conference-website',
                                component: ComponentCreator('/nodes/conference-website', '33b'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/nodes/k8s-cluster',
                                component: ComponentCreator('/nodes/k8s-cluster', '526'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/nodes/load-balancer',
                                component: ComponentCreator('/nodes/load-balancer', 'd06'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/relationships/attendees-attendees-store',
                                component: ComponentCreator('/relationships/attendees-attendees-store', 'a80'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/relationships/conference-website-load-balancer',
                                component: ComponentCreator('/relationships/conference-website-load-balancer', 'fcf'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/relationships/deployed-in-k8s-cluster',
                                component: ComponentCreator('/relationships/deployed-in-k8s-cluster', '1ac'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/relationships/load-balancer-attendees',
                                component: ComponentCreator('/relationships/load-balancer-attendees', '881'),
                                exact: true,
                                sidebar: "docs"
                            },
                            {
                                path: '/',
                                component: ComponentCreator('/', 'bea'),
                                exact: true,
                                sidebar: "docs"
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        path: '*',
        component: ComponentCreator('*'),
    },
];
