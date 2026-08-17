import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import RolePathCards from '@site/src/components/RolePathCards';
import shared from '@site/src/components/shared.module.css';
import styles from './learn.module.css';

const START_HERE = [
    {
        to: '/introduction/what-is-calm',
        title: 'What is CALM?',
        desc: 'The standard, in plain terms — nodes, relationships and metadata.',
    },
    {
        to: '/introduction/why-use-calm',
        title: 'Why use CALM?',
        desc: 'The problems with whiteboard architecture, and how code fixes them.',
    },
    {
        to: '/introduction/key-features',
        title: 'Key features',
        desc: 'Standardized definitions, validation, visualization and reuse.',
    },
    {
        to: '/tutorials/calm-overview-presentation',
        title: 'CALM in 40 Minutes',
        desc: 'A guided overview of the whole model and toolchain.',
    },
];

const LEVELS = [
    {
        to: '/tutorials/beginner/',
        accent: 'var(--calm-green)',
        title: '🟢 Beginner',
        desc: '7 tutorials · ~2 hrs. First node → relationships → a complete architecture.',
    },
    {
        to: '/tutorials/intermediate/',
        accent: 'var(--calm-amber)',
        title: '🟡 Intermediate',
        desc: '13 tutorials. Controls, flows, patterns, standards & the AI advisor.',
    },
    {
        to: '/tutorials/advanced/qcon-demos',
        accent: 'var(--calm-violet)',
        title: '🔴 Advanced',
        desc: 'Deep dives — architecture-discovery skill & the QCon demos.',
    },
    {
        to: '/tutorials/build-a-calm-architecture/',
        accent: 'var(--calm-sky)',
        title: '🛠️ Practitioner',
        desc: '~2–3 hrs capstone. A full governed architecture, end-to-end, with AI.',
    },
];

export default function Learn() {
    return (
        <Layout
            title="Learn"
            description="One front door, two ways in: pick a guided journey for your role, or work the tutorials level by level.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Learn</span>
                        <h1>Start learning CALM</h1>
                        <p>
                            One front door, two ways in: pick a guided{' '}
                            <strong>journey</strong> for your role, or work the{' '}
                            <strong>tutorials</strong> level by level. New to CALM? Start
                            with “What is CALM?”.
                        </p>
                        <div className={styles.bannerCtas}>
                            <Link className={shared.btnPrimary} to="/tutorials/beginner/01-setup">
                                Begin the tutorials →
                            </Link>
                            <Link className={shared.btnGhost} to="/introduction/what-is-calm">
                                What is CALM? · 5-min read
                            </Link>
                        </div>
                    </div>
                </section>

                <section className={clsx(shared.wrap, shared.section, styles.startHere)}>
                    <div className={shared.sectionHead}>
                        <span className={shared.eyebrow}>Start here</span>
                        <h2>Get oriented in five minutes</h2>
                    </div>
                    <div className={shared.grid4}>
                        {START_HERE.map((item) => (
                            <Link className={shared.card} to={item.to} key={item.to}>
                                <h3>{item.title}</h3>
                                <p>{item.desc}</p>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className={styles.journeysBand}>
                    <div className={clsx(shared.wrap, shared.section)}>
                        <div className={shared.sectionHead}>
                            <span className={shared.eyebrow}>By role — journeys</span>
                            <h2>Pick the path that fits you</h2>
                            <p>
                                Each journey is a short, guided route through existing
                                tutorials and reference — ending with something real.
                            </p>
                        </div>
                        <RolePathCards />
                        <p className={styles.deepDives}>
                            Going deeper:{' '}
                            <Link to="/learn/contribute">Contributor guide</Link>
                            {' · '}
                            <Link to="/learn/calm-for-leaders">
                                CALM for engineering leaders — value &amp; adoption
                            </Link>
                        </p>
                    </div>
                </section>

                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.sectionHead}>
                        <span className={shared.eyebrow}>By level — tutorials</span>
                        <h2>Work the path, level by level</h2>
                    </div>
                    <div className={shared.grid4}>
                        {LEVELS.map((level) => (
                            <Link
                                className={clsx(shared.card, styles.levelCard)}
                                style={{'--accent': level.accent}}
                                to={level.to}
                                key={level.to}>
                                <h3>{level.title}</h3>
                                <p>{level.desc}</p>
                            </Link>
                        ))}
                    </div>
                    <div className={styles.browseAll}>
                        <Link className={shared.btnGhost} to="/tutorials/">
                            Browse all tutorials →
                        </Link>
                    </div>
                </section>
            </main>
        </Layout>
    );
}
