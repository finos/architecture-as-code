import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import RolePathCards from '@site/src/components/RolePathCards';
import shared from '@site/src/components/shared.module.css';
import styles from './index.module.css';

function Hero() {
    return (
        <section className={clsx(shared.wrap, styles.hero)}>
            <div>
                <span className={shared.eyebrow}>FINOS · Architecture as Code</span>
                <h1 className={styles.heroTitle}>
                    Software architecture as code — human-readable, machine-validated.
                </h1>
                <p className={styles.heroLead}>
                    CALM is an open-source FINOS specification for defining software
                    architectures in a standardized, version-controlled, machine-readable
                    format — aligning design intent with what you actually build.
                </p>
                <div className={styles.heroCtas}>
                    <Link className={shared.btnPrimary} to="/learn">Start learning →</Link>
                    <Link className={shared.btnGhost} to="/introduction/what-is-calm">
                        What is CALM? · 5-min read
                    </Link>
                </div>
                <div className={styles.heroMeta}>Open source · FINOS incubating · Apache-2.0</div>
            </div>
            <div className={styles.codeCard}>
                <div className={styles.codeCardBar}>
                    <span className={styles.codeCardFile}>trading-system.architecture.json</span>
                    <span className={styles.codeCardOk}>✓ valid</span>
                </div>
                <pre className={styles.codeCardPre}>
                    {'{\n  '}
                    <span className={styles.k}>"nodes"</span>
                    {': [\n    { '}
                    <span className={styles.k}>"unique-id"</span>
                    {': '}
                    <span className={styles.s}>"trading-ui"</span>
                    {',\n      '}
                    <span className={styles.k}>"node-type"</span>
                    {': '}
                    <span className={styles.s}>"webclient"</span>
                    {' },\n    { '}
                    <span className={styles.k}>"unique-id"</span>
                    {': '}
                    <span className={styles.s}>"orders-api"</span>
                    {',\n      '}
                    <span className={styles.k}>"node-type"</span>
                    {': '}
                    <span className={styles.s}>"service"</span>
                    {' }\n  ],\n  '}
                    <span className={styles.k}>"relationships"</span>
                    {': [\n    { '}
                    <span className={styles.k}>"connects"</span>
                    {': {\n      '}
                    <span className={styles.k}>"source"</span>
                    {': '}
                    <span className={styles.s}>"trading-ui"</span>
                    {',\n      '}
                    <span className={styles.k}>"destination"</span>
                    {': '}
                    <span className={styles.s}>"orders-api"</span>
                    {' } }\n  ]\n}'}
                </pre>
                <img
                    className={styles.codeCardDiagram}
                    src="/img/hero-trading-diagram.png"
                    alt="The trading-system architecture rendered as a diagram in CALM Hub: Trading UI connecting to Orders API"
                    width="1210"
                    height="215"
                />
                <div className={styles.codeCardCaption}>
                    <Link href="https://hub.calm.finos.org/">rendered by CALM Hub ↗</Link>
                </div>
            </div>
        </section>
    );
}

function ValueBand() {
    return (
        <div className={styles.value}>
            <div className={clsx(shared.wrap, styles.valueGrid)}>
                <div>
                    <div className={styles.valueN}>01 · STANDARDIZE</div>
                    <div className={styles.valueT}>
                        A common, machine-readable language so every team describes
                        architecture the same way.
                    </div>
                </div>
                <div>
                    <div className={styles.valueN}>02 · AUTOMATE</div>
                    <div className={styles.valueT}>
                        Validate, visualize and document straight from your CI/CD pipeline.
                    </div>
                </div>
                <div>
                    <div className={styles.valueN}>03 · GOVERN</div>
                    <div className={styles.valueT}>
                        Capture controls and standards in the architecture, and enforce
                        them continuously.
                    </div>
                </div>
            </div>
        </div>
    );
}

function RolePicker() {
    return (
        <section className={styles.rolePicker}>
            <div className={clsx(shared.wrap, shared.section)}>
                <div className={shared.sectionHead}>
                    <span className={shared.eyebrow}>Choose your path</span>
                    <h2>Where do you fit? Start with your role.</h2>
                    <p>
                        Six short, guided journeys — each one ends with something real
                        you’ve built, then hands you into the deeper reference.
                    </p>
                </div>
                <RolePathCards />
            </div>
        </section>
    );
}

const ROADMAP_STOPS = [
    {
        accent: 'var(--calm-green)',
        ink: '#14532d',
        inkDark: '#86efac',
        dot: '🟢',
        to: '/tutorials/beginner/01-setup',
        tag: 'STOP 01',
        level: 'Beginner',
        mono: '7 tutorials · ~2 hrs',
        desc: 'First node → relationships → a complete architecture.',
        cardAbove: true,
    },
    {
        accent: 'var(--calm-amber)',
        ink: '#8a4b06',
        inkDark: '#fcd34d',
        dot: '🟡',
        to: '/tutorials/intermediate/08-controls',
        tag: 'STOP 02',
        level: 'Intermediate',
        mono: '13 tutorials',
        desc: 'Controls, flows, patterns, standards & the AI advisor.',
        cardAbove: false,
    },
    {
        accent: 'var(--calm-violet)',
        ink: '#5b21b6',
        inkDark: '#c4b5fd',
        dot: '🔴',
        to: '/tutorials/advanced/qcon-demos',
        tag: 'STOP 03',
        level: 'Advanced',
        mono: 'Deep dives',
        desc: 'Architecture-discovery skill & the QCon demos.',
        cardAbove: true,
    },
    {
        accent: 'var(--calm-sky)',
        ink: '#075985',
        inkDark: '#7dd3fc',
        dot: '🛠️',
        to: '/tutorials/build-a-calm-architecture/tool-setup',
        tag: 'STOP 04',
        level: 'Practitioner',
        mono: '~2–3 hrs · capstone',
        desc: 'A full governed architecture, end-to-end, with AI.',
        cardAbove: false,
    },
];

function JourneyRoadmap() {
    return (
        <section className={clsx(shared.wrap, shared.section)}>
            <div className={shared.sectionHead}>
                <span className={shared.eyebrow}>The learning journey</span>
                <h2>Your CALM journey, from first node to full architecture</h2>
                <p>
                    Four stops, at your own pace — each builds on the last, ending with
                    a complete, governed architecture you built yourself.
                </p>
            </div>
            <div className={styles.journey}>
                <div className={styles.journeyLine} />
                <div className={clsx(styles.journeyPin, styles.journeyPinStart)} aria-hidden="true">◆ START</div>
                <div className={clsx(styles.journeyPin, styles.journeyPinEnd)} aria-hidden="true">🏁 ARRIVE</div>
                {ROADMAP_STOPS.map((stop, i) => {
                    const vars = {
                        '--accent': stop.accent,
                        '--accent-ink': stop.ink,
                        '--accent-ink-dark': stop.inkDark,
                        '--col': i + 1,
                    };
                    return (
                        <div className={styles.stopWrap} style={vars} key={stop.tag}>
                            <div className={styles.stopCell}>
                                <div className={clsx(styles.stopStem, stop.cardAbove ? styles.stemUp : styles.stemDown)} />
                                <div className={styles.stopDot} aria-hidden="true">{stop.dot}</div>
                            </div>
                            <Link
                                to={stop.to}
                                className={clsx(styles.jcard, stop.cardAbove ? styles.above : styles.below)}>
                                <div className={styles.jcardHead}>
                                    <span className={styles.jcardTag}>{stop.tag}</span>
                                    <span className={styles.jcardTtl}>{stop.level}</span>
                                </div>
                                <div className={styles.jcardMono}>{stop.mono}</div>
                                <div className={styles.jcardDesc}>{stop.desc}</div>
                            </Link>
                        </div>
                    );
                })}
            </div>
            <div className={styles.journeyCta}>
                <Link className={shared.btnPrimary} to="/tutorials/beginner/01-setup">
                    Begin the journey — Setup & CLI →
                </Link>
            </div>
        </section>
    );
}

const TOOL_CHIPS = [
    {to: '/working-with-calm/cli', name: 'CLI', desc: 'Generate, validate & document from the terminal.'},
    {to: '/working-with-calm/calm-hub', name: 'CALM Hub', desc: 'A registry of architectures, patterns & controls.'},
    {to: '/working-with-calm/calm-studio', name: 'CALM Studio', desc: 'Draw diagrams, get validated CALM as you go.'},
    {to: '/working-with-calm/vscode-extension', name: 'VS Code', desc: 'Live-validate & visualize inside your editor.'},
    {to: '/working-with-calm/validation-server', name: 'Validation Server', desc: 'Remote HTTP validation for any toolchain.'},
];

function ToolsStrip() {
    return (
        <section className={styles.tools}>
            <div className={shared.wrap}>
                <h2 className={styles.toolsTitle}>One standard, a whole toolchain</h2>
                <p className={styles.toolsSub}>Reference lives one click away inside every journey.</p>
                <div className={styles.toolsGrid}>
                    {TOOL_CHIPS.map((tool) => (
                        <Link to={tool.to} className={styles.toolChip} key={tool.name}>
                            <b>{tool.name}</b>
                            <span>{tool.desc}</span>
                        </Link>
                    ))}
                </div>
                <p className={styles.toolsHosted}>
                    CALM Hub is hosted by FINOS —{' '}
                    <Link href="https://hub.calm.finos.org/">explore the public instance ↗</Link>
                </p>
            </div>
        </section>
    );
}

export default function Home() {
    return (
        <Layout
            title="Common Architecture Language Model"
            description="CALM is an open-source FINOS specification for defining software architectures in a standardized, version-controlled, machine-readable format.">
            <main>
                <Hero />
                <ValueBand />
                <RolePicker />
                <JourneyRoadmap />
                <ToolsStrip />
            </main>
        </Layout>
    );
}
