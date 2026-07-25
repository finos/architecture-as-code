import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';

const CONCEPTS = [
    {to: '/core-concepts/nodes', title: 'Nodes', desc: 'The primary building blocks of your architecture.'},
    {to: '/core-concepts/relationships', title: 'Relationships', desc: 'How nodes connect, interact and depend on each other.'},
    {to: '/core-concepts/interfaces', title: 'Interfaces', desc: 'How nodes expose interaction points.'},
    {to: '/core-concepts/controls', title: 'Controls', desc: 'Apply domain controls to your architecture.'},
    {to: '/core-concepts/standards', title: 'Standards', desc: 'Extend CALM components with organizational requirements.'},
    {to: '/core-concepts/timelines', title: 'Timelines', desc: 'Track how your architecture evolves over time.'},
    {to: '/core-concepts/decorators', title: 'Decorators', desc: 'Attach deployment, security and business metadata.'},
    {to: '/core-concepts/metadata', title: 'Metadata', desc: 'Enrich your architecture with additional information.'},
    {to: '/core-concepts/patterns', title: 'Patterns', desc: 'Reusable, pre-approved architectural structures.'},
    {to: '/core-concepts/widgets', title: 'Widgets', desc: 'Generate Markdown docs from your models with templates.'},
];

export default function Reference() {
    return (
        <Layout
            title="Reference"
            description="The CALM specification — the primary components that make up CALM and the JSON Meta Schema behind them.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Reference</span>
                        <h1>The CALM specification</h1>
                        <p>
                            A comprehensive understanding of the primary components
                            that make up CALM. Master these concepts to effectively
                            define and manage your software architecture.
                        </p>
                    </div>
                </section>
                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.sectionHead}>
                        <span className={shared.eyebrow}>Core concepts</span>
                        <h2>The building blocks</h2>
                    </div>
                    <div className={shared.grid3}>
                        {CONCEPTS.map((concept) => (
                            <Link className={shared.card} to={concept.to} key={concept.title}>
                                <h3>{concept.title}</h3>
                                <p>{concept.desc}</p>
                            </Link>
                        ))}
                    </div>
                    <div className={shared.grid2} style={{marginTop: 18}}>
                        <Link className={clsx(shared.card, shared.cardTint)} to="/working-with-calm/">
                            <h3>Working with CALM →</h3>
                            <p>The practical toolchain — CLI, Hub, Studio, VS Code and more.</p>
                        </Link>
                        <Link className={clsx(shared.card, shared.cardTint)} to="/introduction/what-is-calm">
                            <h3>JSON Meta Schema →</h3>
                            <p>CALM is built on a modular, extensible, version-controlled JSON schema.</p>
                        </Link>
                    </div>
                </section>
            </main>
        </Layout>
    );
}
