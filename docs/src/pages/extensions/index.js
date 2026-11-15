import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';

// One entry for each listed extension. To list yours, add an entry (see "List your extension" below).
const EXTENSIONS = [
    {
        to: '/extensions/c4',
        title: 'C4 model',
        adds: 'C4 lens',
        runs: 'Sidecar',
        provider: 'FINOS CALM',
        desc: 'Context, container, component and deployment diagrams of an architecture, in the look of Structurizr.',
    },
    {
        to: '/extensions/ea-layers',
        title: 'Enterprise architecture layers',
        adds: 'Layers lens',
        runs: 'Sidecar',
        provider: 'FINOS CALM',
        desc: 'Business, application and technology layers of an architecture, in the ArchiMate® notation.',
    },
    {
        to: '/calm-hub/calm-hub-decorator-views',
        title: 'Control evaluation',
        adds: 'Decorator view',
        runs: 'Built into CALM Hub',
        provider: 'FINOS CALM',
        desc: 'Control results as badges on the nodes and relationships of the diagram.',
    },
    {
        to: '/calm-hub/calm-hub-decorator-views',
        title: 'Deployment',
        adds: 'Decorator view',
        runs: 'Built into CALM Hub',
        provider: 'FINOS CALM',
        desc: 'Deployment status as badges on the nodes of the diagram.',
    },
];

const BUILD_LINKS = [
    {to: '/tutorials/advanced/hub-extension', label: 'Tutorial', primary: true},
    {to: '/calm-hub/calm-hub-extension-points', label: 'Extension points'},
    {to: '/calm-hub/calm-hub-extension-blocks', label: 'Extension blocks'},
    {to: '/calm-hub/calm-hub-extension-access', label: 'Extension access'},
    {href: 'https://github.com/finos/architecture-as-code/tree/main/calm-hub-extensions', label: 'Sample extensions ↗'},
];

const meta = {fontSize: 13, opacity: 0.75, marginBottom: 8};

export default function Extensions() {
    return (
        <Layout
            title="Extensions"
            description="Extensions for CALM Hub: new diagram lenses, views and commands, run in your own network.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Extensions</span>
                        <h1>Extend CALM Hub</h1>
                        <p>
                            Add new pictures of your architectures, views and commands to
                            CALM Hub, without a fork. Extensions run in your own network, so
                            your architectures stay with you.
                        </p>
                    </div>
                </section>
                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.grid2}>
                        {EXTENSIONS.map((extension) => (
                            <Link className={shared.card} to={extension.to} key={extension.title}>
                                <h3>{extension.title}</h3>
                                <p style={meta}>{extension.adds} · {extension.runs} · {extension.provider}</p>
                                <p>{extension.desc}</p>
                            </Link>
                        ))}
                    </div>
                    <div className={shared.grid2} style={{marginTop: 18}}>
                        <div className={clsx(shared.card, shared.cardTint)}>
                            <h3>Install an extension</h3>
                            <p style={{marginBottom: 10}}>
                                Run an extension next to CALM Hub with Docker Compose or
                                Kubernetes, and point CALM Hub at it.
                            </p>
                            <Link className={clsx(shared.chip, shared.chipPrimary)} to="/extensions/install">Install guide</Link>
                        </div>
                        <div className={clsx(shared.card, shared.cardTint)}>
                            <h3>Build your own</h3>
                            <p style={{marginBottom: 10}}>
                                An extension is an HTTP service and a manifest. CALM Hub draws
                                what it returns, so no extension code runs in the browser.
                            </p>
                            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                                {BUILD_LINKS.map((link) => (
                                    <Link
                                        className={clsx(shared.chip, link.primary && shared.chipPrimary)}
                                        {...(link.to ? {to: link.to} : {href: link.href})}
                                        key={link.label}>
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className={shared.card} style={{marginTop: 18}}>
                        <h3>List your extension</h3>
                        <p>
                            Open a pull request that adds your extension to this page. It must be
                            open source, have a manifest that CALM Hub accepts, verify the identity
                            assertion of CALM Hub, and have a README with its settings.
                        </p>
                    </div>
                    <p style={{marginTop: 18, fontSize: 13, opacity: 0.75}}>
                        ArchiMate is a registered trademark of The Open Group in the United States and other countries.
                    </p>
                </section>
            </main>
        </Layout>
    );
}
