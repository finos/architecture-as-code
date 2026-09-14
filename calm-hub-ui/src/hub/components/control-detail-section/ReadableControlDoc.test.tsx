import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReadableControlDoc } from './ReadableControlDoc.js';

// Fixtures mirror the two real requirement flavours and the config instance
// seeded in calm-hub/mongo/controls/**.

const schemaRequirement = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://calm.finos.org/calm/domains/security/controls/1/requirement/versions/1.0.0',
    title: 'Data Encryption Control Requirement',
    description: 'Requirements for data encryption controls within the security domain',
    type: 'object',
    properties: {
        'control-id': { const: 'SEC-ENC-001' },
        'encryption-algorithm': {
            type: 'string',
            description: 'The encryption algorithm to use',
            enum: ['AES-128', 'AES-256', 'ChaCha20-Poly1305'],
        },
        'data-at-rest': {
            type: 'boolean',
            description: 'Whether data at rest must be encrypted',
        },
    },
    required: ['control-id', 'encryption-algorithm', 'data-at-rest'],
};

const proseRequirement = {
    $schema: 'https://calm.finos.org/draft/2025-03/meta/control-requirement.json',
    id: 'AIR-SEC-010',
    name: 'Prompt Injection',
    category: 'Security',
    source: 'FINOS AI Governance Framework v2',
    url: 'https://air-governance-framework.finos.org/risks/ri-10_prompt-injection.html',
    summary: 'Prompt injection attacks manipulate AI systems by embedding malicious instructions.',
    requirements: [
        'Implement AI firewall solutions to detect and block prompt injection patterns.',
        'Sanitise and validate all external content before inclusion in LLM prompts.',
    ],
    contributing_factors: ['Insufficient separation between trusted and untrusted inputs.'],
    references: [
        'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
        'https://attack.mitre.org/',
    ],
};

const configuration = {
    'control-id': 'SEC-ENC-001',
    name: 'Data Encryption',
    description: 'Ensure that all sensitive data is encrypted at rest and in transit',
    'encryption-algorithm': 'AES-256',
    'key-rotation-period': '90-days',
    'data-at-rest': true,
    'data-in-transit': true,
};

describe('ReadableControlDoc', () => {
    describe('JSON-Schema-flavour requirement', () => {
        it('renders the header, field list, enum chips and required badges', () => {
            render(<ReadableControlDoc doc={schemaRequirement} />);

            expect(
                screen.getByRole('heading', { name: /Data Encryption Control Requirement/ }),
            ).toBeInTheDocument();
            expect(
                screen.getByText(/Requirements for data encryption controls/),
            ).toBeInTheDocument();
            expect(screen.getByText(schemaRequirement.$id)).toBeInTheDocument();

            expect(screen.getByText('Encryption Algorithm')).toBeInTheDocument();
            expect(screen.getByText('AES-128')).toBeInTheDocument();
            expect(screen.getByText('AES-256')).toBeInTheDocument();
            expect(screen.getByText('ChaCha20-Poly1305')).toBeInTheDocument();
            expect(screen.getByText('must be SEC-ENC-001')).toBeInTheDocument();
            expect(screen.getByText('The encryption algorithm to use')).toBeInTheDocument();

            expect(screen.getAllByText('required')).toHaveLength(3);
        });

        it('does not echo JSON Schema structural keys as rows', () => {
            render(<ReadableControlDoc doc={schemaRequirement} />);

            expect(screen.queryByText('$schema')).not.toBeInTheDocument();
            expect(screen.queryByText('properties')).not.toBeInTheDocument();
            expect(screen.queryByText('$id')).not.toBeInTheDocument();
        });

        it('expands one nesting level of object properties only', () => {
            const nested = {
                type: 'object',
                properties: {
                    policy: {
                        type: 'object',
                        properties: {
                            ttl: { type: 'string' },
                            inner: {
                                type: 'object',
                                properties: { deepest: { type: 'string' } },
                            },
                        },
                    },
                },
            };
            render(<ReadableControlDoc doc={nested} />);

            expect(screen.getByText('Policy')).toBeInTheDocument();
            expect(screen.getByText('Ttl')).toBeInTheDocument();
            expect(screen.getByText('Inner')).toBeInTheDocument();
            expect(screen.queryByText('Deepest')).not.toBeInTheDocument();
        });
    });

    describe('prose-flavour requirement', () => {
        it('renders the header, meta chips, url link and prose lists', () => {
            render(<ReadableControlDoc doc={proseRequirement} />);

            expect(screen.getByRole('heading', { name: 'Prompt Injection' })).toBeInTheDocument();
            expect(screen.getByText(/Prompt injection attacks manipulate AI systems/)).toBeInTheDocument();
            expect(screen.getByText('AIR-SEC-010')).toBeInTheDocument();
            expect(screen.getByText('Security')).toBeInTheDocument();
            expect(screen.getByText('FINOS AI Governance Framework v2')).toBeInTheDocument();

            expect(
                screen.getByRole('link', { name: /air-governance-framework/ }),
            ).toHaveAttribute('href', proseRequirement.url);

            expect(screen.getByText('Requirements')).toBeInTheDocument();
            expect(
                screen.getByText(/Implement AI firewall solutions/),
            ).toBeInTheDocument();
            expect(screen.getByText('Contributing Factors')).toBeInTheDocument();
            expect(screen.getByText('References')).toBeInTheDocument();
        });

        it('renders reference URLs as external links', () => {
            render(<ReadableControlDoc doc={proseRequirement} />);

            const owasp = screen.getByRole('link', { name: /owasp\.org/ });
            expect(owasp).toHaveAttribute('href', proseRequirement.references[0]);
            expect(owasp).toHaveAttribute('target', '_blank');
            expect(owasp).toHaveAttribute('rel', 'noopener noreferrer');
            expect(screen.getByRole('link', { name: /attack\.mitre\.org/ })).toBeInTheDocument();
        });
    });

    describe('configuration instance', () => {
        it('renders the header and field rows with boolean badges', () => {
            render(<ReadableControlDoc doc={configuration} />);

            expect(screen.getByRole('heading', { name: 'Data Encryption' })).toBeInTheDocument();
            expect(screen.getByText(/Ensure that all sensitive data is encrypted/)).toBeInTheDocument();
            expect(screen.getByText('SEC-ENC-001')).toBeInTheDocument();

            expect(screen.getByText('Encryption Algorithm')).toBeInTheDocument();
            expect(screen.getByText('AES-256')).toBeInTheDocument();
            expect(screen.getByText('Key Rotation Period')).toBeInTheDocument();

            const trueBadges = screen.getAllByText('true');
            expect(trueBadges).toHaveLength(2);
            trueBadges.forEach((b) => expect(b).toHaveClass('badge'));
        });

        it('does not repeat the control-id as a field row', () => {
            render(<ReadableControlDoc doc={configuration} />);
            expect(screen.queryByText('Control Id')).not.toBeInTheDocument();
        });
    });

    describe('never hides a value', () => {
        it('renders a top-level `type` on a non-schema document as a field row', () => {
            render(<ReadableControlDoc doc={{ id: 'X', type: 'ai-risk', summary: 'A risk.' } as never} />);
            expect(screen.getByText('Type')).toBeInTheDocument();
            expect(screen.getByText('ai-risk')).toBeInTheDocument();
        });

        it('shows both `title` and a distinct `name`, and both `description` and a distinct `summary`', () => {
            render(
                <ReadableControlDoc
                    doc={{
                        title: 'Long Title',
                        name: 'short-name',
                        description: 'The description.',
                        summary: 'A different summary.',
                    } as never}
                />,
            );
            expect(screen.getByRole('heading', { name: 'Long Title' })).toBeInTheDocument();
            expect(screen.getByText('short-name')).toBeInTheDocument();
            expect(screen.getByText('The description.')).toBeInTheDocument();
            expect(screen.getByText('A different summary.')).toBeInTheDocument();
        });
    });

    describe('fallback and empty states', () => {
        it('shows the empty-state message when no document is given', () => {
            render(<ReadableControlDoc />);
            expect(screen.getByText('Please select a document to load.')).toBeInTheDocument();
        });

        it('renders an empty object via the generic fallback', () => {
            render(<ReadableControlDoc doc={{}} />);
            expect(screen.getByText('empty object')).toBeInTheDocument();
        });

        it('renders an unrecognised shape without hiding anything', () => {
            render(<ReadableControlDoc doc={{ foo: [1, 2], bar: { deeply: { nested: 'x' } } } as never} />);
            expect(screen.getByText('Foo')).toBeInTheDocument();
            expect(screen.getByText('Bar')).toBeInTheDocument();
            expect(screen.getByText('deeply')).toBeInTheDocument();
            expect(screen.getByText('nested')).toBeInTheDocument();
        });
    });
});
