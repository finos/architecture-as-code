import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';

const LAB_URL = 'https://lab.calm.finos.org';

const STEPS = [
    {
        title: 'Look around',
        desc: 'Read a real CALM architecture and validate it against the CALM 1.2 schemas.',
    },
    {
        title: 'Add the Orders API',
        desc: 'Edit the model to add a service node, and watch the diagram follow.',
    },
    {
        title: 'Connect them',
        desc: 'Add a connects relationship, then validate the finished architecture.',
    },
];

export default function LearnLab() {
    return (
        <Layout
            title="Learning Lab"
            description="Model and validate a real CALM architecture entirely in your browser — a terminal, an editor and a live diagram, no install required.">
            <main>
                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.sectionHead}>
                        <span className={shared.eyebrow}>Try it</span>
                        <h1>Learning Lab</h1>
                        <p>
                            Model and validate a real CALM architecture in your browser — a
                            terminal, an editor and a live diagram, running the same validation
                            engine as the CLI. Nothing to install.
                        </p>
                    </div>
                    <div>
                        <Link
                            className={shared.btnPrimary}
                            href={LAB_URL}
                            target="_blank"
                            rel="noopener">
                            Open the lab ↗
                        </Link>
                    </div>
                    <p>
                        The lab is hosted on its own domain so organisations that restrict
                        interactive sites can allow-list it separately from the documentation.
                    </p>
                </section>

                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.sectionHead}>
                        <span className={shared.eyebrow}>What you&apos;ll do</span>
                        <h2>Three steps, about ten minutes</h2>
                    </div>
                    <div className={shared.grid3}>
                        {STEPS.map((step) => (
                            <div className={shared.card} key={step.title}>
                                <h3>{step.title}</h3>
                                <p>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </Layout>
    );
}
