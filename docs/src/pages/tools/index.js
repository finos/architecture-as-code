import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import shared from '@site/src/components/shared.module.css';

const TOOLS = [
    {to: '/working-with-calm/cli', title: 'CLI', desc: 'Install, navigate and use the CALM CLI to generate, validate and document architectures, and interact with CALM Hub.'},
    {to: '/working-with-calm/calm-hub', title: 'CALM Hub', desc: 'Explore and inspect the visual registry of architectures, patterns and compliance controls.'},
    {to: '/working-with-calm/calm-studio', title: 'CALM Studio', desc: 'Design architecture diagrams visually and generate validated CALM as you draw.'},
    {to: '/working-with-calm/vscode-extension', title: 'VS Code Extension', desc: 'Live-validate, visualise and navigate CALM architectures directly inside your editor.'},
    {to: '/working-with-calm/validation-server', title: 'Validation Server', desc: 'Run a standalone HTTP server for remote CALM architecture validation.'},
    {to: '/working-with-calm/voice-mode', title: 'Voice Mode', desc: 'Enable hands-free interaction with CALM Copilot Chat using voice commands.'},
    {to: '/working-with-calm/calm-ai-tools', title: 'CALM AI Tools', desc: 'Expand support for additional AI assistants in CALM architecture modeling.'},
];

const HUB_LINKS = [
    {href: 'https://hub.calm.finos.org/', label: 'Open the hosted Hub ↗', primary: true},
    {to: '/calm-hub/', label: 'Hub Overview'},
    {to: '/calm-hub/calm-hub-developer-guide', label: 'Developer Guide'},
    {to: '/calm-hub/calm-hub-mcp-api', label: 'MCP & API'},
    {to: '/working-with-calm/calm-hub-entitlements', label: 'Entitlements'},
];

export default function Tools() {
    return (
        <Layout
            title="Tools"
            description="The CALM toolchain — define, validate and visualize your software architecture, from the CLI to the editor.">
            <main>
                <section className={shared.banner}>
                    <div className={shared.wrap}>
                        <span className={shared.eyebrow}>Tools</span>
                        <h1>One standard, a whole toolchain</h1>
                        <p>
                            The practical aspects of using CALM to define, validate
                            and visualize your software architecture — from the CLI
                            to the editor.
                        </p>
                    </div>
                </section>
                <section className={clsx(shared.wrap, shared.section)}>
                    <div className={shared.grid3}>
                        {TOOLS.map((tool) => (
                            <Link className={shared.card} to={tool.to} key={tool.title}>
                                <h3>{tool.title}</h3>
                                <p>{tool.desc}</p>
                            </Link>
                        ))}
                    </div>
                    <div className={clsx(shared.card, shared.cardTint)} style={{marginTop: 18}}>
                        <h3>CALM Hub — deeper</h3>
                        <p style={{marginBottom: 10}}>
                            Explore the FINOS-hosted, publicly accessible Hub, or go
                            deeper: overview, developer guide, MCP &amp; API, and
                            entitlements.
                        </p>
                        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                            {HUB_LINKS.map((link) => (
                                <Link
                                    className={clsx(shared.chip, link.primary && shared.chipPrimary)}
                                    {...(link.to ? {to: link.to} : {href: link.href})}
                                    key={link.label}>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </Layout>
    );
}
