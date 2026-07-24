import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';
import styles from './community.module.css';

const CARDS = [
    {
        href: 'https://github.com/finos/architecture-as-code',
        title: 'GitHub repository',
        desc: 'The Architecture as Code monorepo — source, issues and releases.',
    },
    {
        href: 'https://github.com/finos/architecture-as-code/discussions',
        title: 'Discussions',
        desc: 'Ask questions and talk with the community.',
    },
    {
        href: 'https://github.com/finos/architecture-as-code/issues',
        title: 'Issues & requests',
        desc: 'Report a bug or request a feature.',
    },
    {
        to: '/talks/',
        title: 'Talks & overview 🎤',
        desc: 'CALM in 40 Minutes and conference demos.',
    },
    {
        to: '/learn/journeys/contributor',
        title: 'Contribute',
        desc: 'Set up the monorepo and ship your first pull request.',
    },
    {
        href: 'https://calendar.finos.org/',
        title: 'Meetups & office hours',
        desc: 'Community calls and office hours are listed on the FINOS project calendar.',
        highlight: true,
    },
];

export default function Community() {
    return (
        <Layout
            title="Community"
            description="CALM is developed by the Architecture as Code (AasC) community under FINOS. Join in — ask questions, file issues, and contribute.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Community</span>
                        <h1>Built in the open, under FINOS</h1>
                        <p>
                            CALM is developed by the Architecture as Code (AasC)
                            community. Join in — ask questions, file issues, and
                            contribute.
                        </p>
                    </div>
                </section>
                <section className={clsx(shared.wrap, shared.section)}>
                    <h2 className={styles.srOnly}>Get involved</h2>
                    <div className={shared.grid3}>
                        {CARDS.map((card) => (
                            <Link
                                className={clsx(shared.card, card.highlight && styles.highlightCard)}
                                {...(card.to ? {to: card.to} : {href: card.href})}
                                key={card.title}>
                                <h3>{card.title}</h3>
                                <p>{card.desc}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </Layout>
    );
}
