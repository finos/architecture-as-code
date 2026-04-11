// SPDX-FileCopyrightText: 2024 FINOS CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Visual Canvas Editor',
    description: (
      <>
        Drag-and-drop architecture design with real-time CALM JSON synchronization.
        Every node and relationship you draw is instantly reflected as validated
        CALM 1.2 architecture-as-code.
      </>
    ),
  },
  {
    title: 'MCP Server for AI Integration',
    description: (
      <>
        21 MCP tools let AI assistants like Claude create, query, and modify
        CALM architectures through natural language. Fully integrated with
        the FINOS AI Governance Framework (AIGF).
      </>
    ),
  },
  {
    title: 'Extension Packs',
    description: (
      <>
        Built-in packs for AWS, Azure, GCP, Kubernetes, FluxNova, and AI services.
        Write custom packs in TypeScript to extend the node palette with your
        organization's building blocks.
      </>
    ),
  },
];

function Feature({ title, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">
          Draw visually. Get validated architecture-as-code. Let AI generate via MCP.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            Get Started in 5 Minutes
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            href="https://calm.finos.org/release/1.2/"
            style={{ marginLeft: '1rem' }}>
            FINOS CALM Ecosystem
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} — Visual CALM Architecture Editor`}
      description="CalmStudio is a visual editor for FINOS CALM architecture-as-code. Draw diagrams, get validated JSON, integrate AI via MCP.">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {FeatureList.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
