import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';
import styles from './styles.module.css';

function StepLink({step, children, className}) {
    return step.href
        ? <Link href={step.href} className={className}>{children}</Link>
        : <Link to={step.to} className={className}>{children}</Link>;
}

/**
 * Shared template for the six /learn/journeys/<role> pages.
 * All content comes from the journey entries in ./journeys.js.
 */
export default function JourneyPage({journey}) {
    const accentVars = {
        '--accent-light': journey.accent,
        '--accent-dark': journey.accentDark,
    };
    return (
        <Layout title={journey.title} description={journey.intro}>
            <div className={styles.root} style={accentVars}>
                <section className={styles.banner}>
                    <div className={shared.wrap}>
                        <nav className={shared.breadcrumb} aria-label="Breadcrumb">
                            <Link to="/">Home</Link>
                            <span className={shared.breadcrumbSep}>/</span>
                            <Link to="/learn">Learn</Link>
                            <span className={shared.breadcrumbSep}>/</span>
                            <span>{journey.roleLabel}</span>
                        </nav>
                        <div className={styles.bannerHead}>
                            <div
                                className={clsx(styles.iconTile, journey.icon.length > 1 && styles.iconTileSmall)}
                                aria-hidden="true">
                                {journey.icon}
                            </div>
                            <div>
                                <div className={styles.kicker}>{journey.roleLabel}</div>
                                <h1 className={styles.title}>{journey.title}</h1>
                            </div>
                        </div>
                        <p className={styles.intro}>{journey.intro}</p>
                        <div className={styles.ctaRow}>
                            <StepLink step={journey.cta} className={styles.ctaBtn}>
                                {journey.cta.label}
                            </StepLink>
                        </div>
                    </div>
                </section>
                <section className={clsx(shared.wrap, styles.pathSection)}>
                    <div className={styles.pathHead}>
                        <h2 className={styles.pathEyebrow}>Your path</h2>
                        <span className={styles.stepCount}>{journey.steps.length} steps</span>
                    </div>
                    {journey.steps.map((step, i) => (
                        <div className={styles.step} key={step.title}>
                            <div className={styles.stepNum}>{i + 1}</div>
                            <div className={styles.stepCard}>
                                <div className={styles.stepKicker}>{step.kicker}</div>
                                <h3 className={styles.stepTitle}>
                                    <StepLink step={step} className={styles.stepTitleLink}>
                                        {step.title}
                                    </StepLink>
                                </h3>
                                <p className={styles.stepDesc}>{step.description}</p>
                            </div>
                        </div>
                    ))}
                    <div className={styles.outcome}>
                        <div className={styles.stepKicker}>🏁 What you’ll have built</div>
                        <div className={styles.outcomeText}>{journey.outcome}</div>
                    </div>
                    <div className={styles.footBtns}>
                        <Link className={shared.btnGhost} to="/learn">← All journeys</Link>
                        <Link className={shared.btnGhost} to="/tutorials/">Browse all tutorials</Link>
                    </div>
                </section>
            </div>
        </Layout>
    );
}
