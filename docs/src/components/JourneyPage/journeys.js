import React from 'react';
import Link from '@docusaurus/Link';

/**
 * Data for the six role journeys surfaced on the homepage role picker,
 * the Learn hub, and the /learn/journeys/<role> pages.
 *
 * Per-role accents: architect #007dff, developer #16a34a,
 * governance #d97706, leader #7c3aed, contributor #0284c7,
 * exploring #64748b. `accentDark` is a lightened variant of the same hue
 * so text and icons keep enough contrast on dark surfaces.
 */
export const journeys = {
    architect: {
        slug: 'architect',
        accent: '#007dff',
        accentDark: '#4da3ff',
        icon: '▤',
        roleLabel: 'For architects',
        cardTitle: 'Model & visualize a system',
        cardBlurb: 'Describe your first architecture in CALM and generate a live diagram from it.',
        cardMeta: '6 steps · ~1-2 hrs',
        title: 'Model & visualize a system',
        intro: 'Go from a blank file to a validated architecture with a live diagram. You’ll model the core elements, then render them.',
        cta: {label: 'Create your first node →', to: '/tutorials/beginner/02-first-node'},
        steps: [
            {
                kicker: 'Start here',
                title: 'What is CALM?',
                to: '/introduction/what-is-calm',
                description: 'Understand nodes, relationships and metadata — the three building blocks.',
            },
            {
                kicker: 'Reference',
                title: 'Nodes, relationships & interfaces',
                to: '/core-concepts/nodes',
                description: 'Learn the properties of nodes, relationships and interfaces before you start modelling.',
            },
            {
                kicker: 'Tutorial · Beginner',
                title: 'Create your first node',
                to: '/tutorials/beginner/02-first-node',
                description: 'Write your first CALM architecture file with AI assistance.',
            },
            {
                kicker: 'Tutorial · Beginner',
                title: 'Add relationships',
                to: '/tutorials/beginner/03-relationships',
                description: 'Connect your nodes to show how the system fits together.',
            },
            {
                kicker: 'Tutorial · Beginner',
                title: 'Build a complete architecture',
                to: '/tutorials/beginner/07-complete-architecture',
                description: 'Assemble a realistic multi-service architecture end-to-end.',
            },
            {
                kicker: 'Tools',
                title: 'Visualize it',
                to: '/working-with-calm/vscode-extension',
                description: (
                    <>
                        Live-validate and visualize inside your editor — or draw in{' '}
                        <Link to="/working-with-calm/calm-studio">CALM Studio</Link>.
                    </>
                ),
            },
        ],
        outcome: 'A complete, validated CALM architecture rendered as a live diagram.',
    },

    developer: {
        slug: 'developer',
        accent: '#16a34a',
        accentDark: '#34d47a',
        icon: '</>',
        roleLabel: 'For developers',
        cardTitle: 'Validate in your repo & CI',
        cardBlurb: 'Install the CLI, wire CALM into a pipeline, and catch drift on every pull request.',
        cardMeta: '6 steps · ~2 hrs',
        title: 'Validate in your repo & CI',
        intro: 'Bring CALM into your repository and pipeline so architecture is validated on every change.',
        cta: {label: 'Start with Setup & CLI →', to: '/tutorials/beginner/01-setup'},
        steps: [
            {
                kicker: 'Tutorial · Beginner',
                title: 'Setup & CLI',
                to: '/tutorials/beginner/01-setup',
                description: 'Install the CALM CLI and initialize your architecture repository.',
            },
            {
                kicker: 'Tools',
                title: 'CLI reference',
                to: '/working-with-calm/cli',
                description: 'The full command set for generate, validate and document.',
            },
            {
                kicker: 'Tutorial · Beginner',
                title: 'Build a complete architecture',
                to: '/tutorials/beginner/07-complete-architecture',
                description: 'Have a real architecture file to validate against.',
            },
            {
                kicker: 'Tutorial · Intermediate',
                title: 'Patterns',
                to: '/tutorials/intermediate/17-patterns',
                description: 'Define reusable, pre-approved architectural patterns.',
            },
            {
                kicker: 'Tutorial · Intermediate',
                title: 'Enforce with multi-pattern validation',
                to: '/tutorials/intermediate/20-multi-pattern-validation',
                description: 'Validate architectures against your patterns to catch drift.',
            },
            {
                kicker: 'Tools',
                title: 'Remote validation server',
                to: '/working-with-calm/validation-server',
                description: 'Run a standalone HTTP server for validation in any toolchain.',
            },
        ],
        outcome: 'CALM validation wired into your pipeline, catching architectural drift on every pull request.',
    },

    governance: {
        slug: 'governance',
        accent: '#d97706',
        accentDark: '#f0a437',
        icon: '§',
        roleLabel: 'Governance & risk',
        cardTitle: 'Automate controls & standards',
        cardBlurb: 'Turn architectural controls and organizational standards into checks that run automatically.',
        cardMeta: '6 steps · ~2 hrs',
        title: 'Automate controls & standards',
        intro: 'Turn architectural controls and organizational standards into checks that run automatically.',
        cta: {label: 'Understand controls →', to: '/core-concepts/controls'},
        steps: [
            {
                kicker: 'Start here',
                title: 'Why use CALM? (control & compliance)',
                to: '/introduction/why-use-calm',
                description: 'How CALM enforces standards and captures compliance requirements.',
            },
            {
                kicker: 'Reference',
                title: 'Controls',
                to: '/core-concepts/controls',
                description: 'Apply security and operational policies to architecture elements.',
            },
            {
                kicker: 'Reference',
                title: 'Standards',
                to: '/core-concepts/standards',
                description: 'Extend CALM components with organizational requirements.',
            },
            {
                kicker: 'Tutorial · Intermediate',
                title: 'Add controls',
                to: '/tutorials/intermediate/08-controls',
                description: 'Attach governance controls to your architecture.',
            },
            {
                kicker: 'Tutorial · Intermediate',
                title: 'Define & enforce standards',
                to: '/tutorials/intermediate/18-standards',
                description: (
                    <>
                        Create organizational standards, then{' '}
                        <Link to="/tutorials/intermediate/19-enforcing-standards">enforce them</Link>.
                    </>
                ),
            },
            {
                kicker: 'Tutorial · Intermediate',
                title: 'Multi-pattern validation',
                to: '/tutorials/intermediate/20-multi-pattern-validation',
                description: 'Continuously validate compliance across patterns.',
            },
        ],
        outcome: 'Controls and standards captured in the architecture and enforced automatically in CI.',
    },

    leader: {
        slug: 'leader',
        accent: '#7c3aed',
        accentDark: '#a78bfa',
        icon: '◈',
        roleLabel: 'Engineering leaders',
        cardTitle: 'See how CALM de-risks delivery',
        cardBlurb: 'A no-code tour of the value, adoption model, and where teams see returns.',
        cardMeta: '6 short reads · ~15 min',
        title: 'See how CALM de-risks delivery',
        intro: 'A no-code tour of what CALM is, why it matters, and how teams adopt it.',
        cta: {label: 'Start with “What is CALM?” →', to: '/introduction/what-is-calm'},
        steps: [
            {
                kicker: 'Start here',
                title: 'What is CALM?',
                to: '/introduction/what-is-calm',
                description: 'The standard in plain terms — no setup required.',
            },
            {
                kicker: 'Read',
                title: 'Why use CALM?',
                to: '/introduction/why-use-calm',
                description: 'The cost of disconnected architecture, and the payoff of code.',
            },
            {
                kicker: 'Read',
                title: 'Key features',
                to: '/introduction/key-features',
                description: 'Standardization, validation, visualization and reuse.',
            },
            {
                kicker: 'Talk',
                title: 'CALM in 40 Minutes',
                to: '/tutorials/calm-overview-presentation',
                description: 'A guided overview of the model and toolchain.',
            },
            {
                kicker: 'Explore',
                title: 'The toolchain',
                to: '/working-with-calm/',
                description: 'What your teams would actually use day to day.',
            },
            {
                kicker: 'Summary',
                title: 'CALM for engineering leaders — value & adoption',
                to: '/learn/calm-for-leaders',
                description: 'A one-page brief on ROI and a phased adoption model.',
            },
        ],
        outcome: 'A clear view of CALM’s value and a plan for where to adopt it first.',
    },

    contributor: {
        slug: 'contributor',
        accent: '#0284c7',
        accentDark: '#38bdf8',
        icon: '⎇',
        roleLabel: 'For contributors',
        cardTitle: 'Build & ship your first PR',
        cardBlurb: 'Set up the monorepo, find a good first issue, and get your change merged.',
        cardMeta: '5 steps · at your pace',
        title: 'Build & ship your first PR',
        intro: 'Get the monorepo running locally, find a good first issue, and ship your first pull request.',
        cta: {label: 'Go to the repository →', href: 'https://github.com/finos/architecture-as-code'},
        steps: [
            {
                kicker: 'Setup',
                title: 'Set up the monorepo',
                to: '/learn/contribute',
                description: 'Clone finos/architecture-as-code and build the workspace locally.',
            },
            {
                kicker: 'Tools',
                title: 'Understand the CLI',
                to: '/working-with-calm/cli',
                description: 'Get familiar with the tool most contributions touch.',
            },
            {
                kicker: 'Contribute',
                title: 'Find a good first issue',
                href: 'https://github.com/finos/architecture-as-code/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22',
                description: 'Pick an issue labelled "good first issue" to start with.',
            },
            {
                kicker: 'Contribute',
                title: 'Make your change',
                href: 'https://github.com/finos/architecture-as-code',
                description: 'Branch, implement and test against the monorepo.',
            },
            {
                kicker: 'Contribute',
                title: 'Open your pull request',
                href: 'https://github.com/finos/architecture-as-code/pulls',
                description: 'Submit your PR and work with a maintainer to merge.',
            },
        ],
        outcome: 'Your first merged contribution to CALM.',
    },

    exploring: {
        slug: 'exploring',
        accent: '#64748b',
        accentDark: '#94a3b8',
        icon: '?',
        roleLabel: 'Just exploring',
        cardTitle: 'What is CALM, and why?',
        cardBlurb: 'The problem it solves and the core idea — in five minutes, no setup required.',
        cardMeta: '4 short reads · ~15 min',
        title: 'What is CALM, and why?',
        intro: 'Five minutes, no setup. Understand the idea and decide if it’s for you.',
        cta: {label: 'Ready to build? Pick your path →', to: '/learn'},
        steps: [
            {
                kicker: 'Read',
                title: 'What is CALM?',
                to: '/introduction/what-is-calm',
                description: 'The standard in plain terms.',
            },
            {
                kicker: 'Read',
                title: 'Why use CALM?',
                to: '/introduction/why-use-calm',
                description: 'The problem it solves.',
            },
            {
                kicker: 'Read',
                title: 'Key features',
                to: '/introduction/key-features',
                description: 'What you get.',
            },
            {
                kicker: 'Talk',
                title: 'CALM in 40 Minutes',
                to: '/tutorials/calm-overview-presentation',
                description: 'Go deeper when you’re ready.',
            },
        ],
        outcome: 'A solid grasp of what CALM is and the problems it solves.',
    },
};

/** The six journeys in role-picker display order. */
export const journeyList = [
    journeys.architect,
    journeys.developer,
    journeys.governance,
    journeys.leader,
    journeys.contributor,
    journeys.exploring,
];
