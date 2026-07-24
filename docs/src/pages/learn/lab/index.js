import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Layout from '@theme/Layout';

const Lab = React.lazy(() => import('@site/src/components/Lab/Lab'));

function Loading() {
    return (
        <div
            style={{
                padding: '96px 28px',
                textAlign: 'center',
                color: 'var(--calm-muted)',
                fontFamily: 'var(--ifm-font-family-monospace)',
                fontSize: 14,
            }}>
            loading the lab…
        </div>
    );
}

export default function LearnLab() {
    return (
        <Layout
            noFooter
            title="Learning Lab"
            description="Model and validate a real CALM architecture entirely in your browser — a terminal, an editor and a live diagram, no install required.">
            <BrowserOnly fallback={<Loading />}>
                {() => (
                    <React.Suspense fallback={<Loading />}>
                        <Lab />
                    </React.Suspense>
                )}
            </BrowserOnly>
        </Layout>
    );
}
