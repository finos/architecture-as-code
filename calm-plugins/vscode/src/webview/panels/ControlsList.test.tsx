import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControlsList } from './ControlsList';
import type { ControlEntry } from './control-metadata';
import type { RequirementPropertyDef } from '../../extension/services/requirement-parser';
import * as fixtures from './__fixtures__/controls';

describe('ControlsList', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders empty state when no controls', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList controls={undefined} onUpdate={onUpdate} />
        );
        // Section not expanded by default
        expect(html).toContain('Controls');
        expect(html).not.toContain('No controls defined');
    });

    it('expands and shows controls count', () => {
        const onUpdate = vi.fn();
        const controls: Record<string, ControlEntry> = {
            'api-gw': {
                description: 'API Gateway',
                requirements: [{ 'requirement-url': 'x' }],
            },
            ssl: {
                description: 'SSL/TLS',
                requirements: [{ 'requirement-url': 'y' }],
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={controls}
                onUpdate={onUpdate}
                expandControl="api-gw"
            />
        );
        expect(html).toContain('Controls');
        expect(html).toContain('>2<'); // Count badge rendered as span content
        expect(html).toContain('api-gw');
        expect(html).toContain('API Gateway');
    });

    it('renders legacy control with simple value config', () => {
        const onUpdate = vi.fn();
        const control: ControlEntry = {
            description: 'Legacy control',
            requirements: [
                {
                    'requirement-url': 'legacy.json',
                    config: { value: 'configured' },
                },
            ],
            metadata: {
                validation: { 'allowed-values': ['configured', 'other'] },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ 'legacy-ctrl': control }}
                onUpdate={onUpdate}
                expandControl="legacy-ctrl"
            />
        );
        expect(html).toContain('Legacy control');
        expect(html).toContain('configured');
        expect(html).toContain('legacy.json'); // URL shown
        expect(html).toContain('<select'); // Should be dropdown, not text
    });

    it('renders legacy control with allowed-values as dropdown (not text)', () => {
        const onUpdate = vi.fn();
        const control: ControlEntry = {
            description: 'Choose an option',
            requirements: [
                { 'requirement-url': 'x.json', config: { value: 'Stratum' } },
            ],
            metadata: {
                validation: {
                    'allowed-values': ['Stratum', 'AWS API GW', 'Kong'],
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ 'api-gw': control }}
                onUpdate={onUpdate}
                expandControl="api-gw"
            />
        );
        // Should render a <select>, not a text input
        expect(html).toContain('<select');
        expect(html).toContain('Stratum');
        expect(html).toContain('AWS API GW');
        expect(html).toContain('Kong');
        // Should NOT be a text input with value="Stratum"
        expect(html).not.toMatch(/<input[^>]*type="text"[^>]*value="Stratum"/);
    });

    it('renders new control with enum property as dropdown', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            provider: {
                type: 'enum',
                allowedValues: ['AWS', 'GCP', 'Azure'],
                required: true,
            },
        };
        const control: ControlEntry = {
            description: 'Select cloud provider',
            requirements: [
                {
                    'requirement-url': 'cloud.json',
                    config: { provider: 'AWS' },
                },
            ],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'cloud-001',
                        name: 'Cloud Provider',
                        description: 'desc',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ cloud: control }}
                onUpdate={onUpdate}
                expandControl="cloud"
            />
        );
        // Should detect enum type and render dropdown
        expect(html).toContain('<select');
        expect(html).toContain('AWS');
        expect(html).toContain('GCP');
        expect(html).toContain('Azure');
        expect(html).toContain('provider'); // Property name as label
        // Should show current value
        expect(html).toContain('AWS');
    });

    it('renders real gateway control with allowedValues-only enum metadata as dropdown', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ gateway: fixtures.gatewayTypeControl }}
                onUpdate={onUpdate}
                expandControl="gateway"
            />
        );
        expect(html).toContain('Gateway Type');
        expect(html).toContain('<select');
        expect(html).toContain('Edge');
        expect(html).toContain('Internal');
        expect(html).not.toContain('Enter value...');
    });

    it('renders enum property with allowedValues including numbers', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            port: {
                type: 'enum',
                allowedValues: [80, 443, 8080],
                required: true,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { port: 443 } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'port-001',
                        name: 'Port',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ port: control }}
                onUpdate={onUpdate}
                expandControl="port"
            />
        );
        expect(html).toContain('<select');
        expect(html).toContain('>80<');
        expect(html).toContain('>443<');
        expect(html).toContain('>8080<');
    });

    it('renders enum property without allowedValues as dropdown (data validation issue, not UI)', () => {
        // If a control is defined as type='enum', it MUST render as a dropdown.
        // If allowedValues are missing, that's a schema/data problem, not a UI problem.
        // The dropdown shows empty (only "— Select —") to indicate misconfiguration.
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            broken: {
                type: 'enum',
                // Missing: allowedValues
                required: false,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { broken: 'value' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'broken-001',
                        name: 'Broken',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ broken: control }}
                onUpdate={onUpdate}
                expandControl="broken"
            />
        );
        // Even without allowedValues, enum types render as dropdowns (type contract)
        expect(html).toContain('<select');
        expect(html).toContain('— Select —');
        // NOT a text input
        expect(html).not.toMatch(/<input[^>]*type="text"[^>]*value="value"/);
    });

    it('renders string property with pattern as text input with hint', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            path: {
                type: 'string',
                pattern: '^/[a-z]+$',
                description: 'URL path',
                required: true,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { path: '/health' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'health-001',
                        name: 'Health Path',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ health: control }}
                onUpdate={onUpdate}
                expandControl="health"
            />
        );
        expect(html).toContain('<input');
        expect(html).toContain('type="text"');
        expect(html).toContain('/health');
        expect(html).toContain('URL path');
        expect(html).toContain('Pattern: ^/[a-z]+$');
    });

    it('renders boolean property as three-state select (Select, true, false)', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            enabled: {
                type: 'boolean',
                required: true,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { enabled: 'true' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'bool-001',
                        name: 'Bool',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ bool: control }}
                onUpdate={onUpdate}
                expandControl="bool"
            />
        );
        expect(html).toContain('<select');
        expect(html).toContain('true');
        expect(html).toContain('false');
        expect(html).toContain('— Select —');
    });

    it('renders number property with step=any for decimal', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            timeout: {
                type: 'number',
                required: false,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { timeout: '30.5' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'num-001',
                        name: 'Num',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ num: control }}
                onUpdate={onUpdate}
                expandControl="num"
            />
        );
        expect(html).toContain('type="number"');
        expect(html).toContain('step="any"');
        expect(html).toContain('30.5');
    });

    it('renders integer property with step=1', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            retries: {
                type: 'integer',
                required: false,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { retries: '3' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'int-001',
                        name: 'Int',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ int: control }}
                onUpdate={onUpdate}
                expandControl="int"
            />
        );
        expect(html).toContain('type="number"');
        expect(html).toContain('step="1"');
        expect(html).toContain('3');
    });

    it('marks required properties with asterisk', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            'required-prop': { type: 'string', required: true },
            'optional-prop': { type: 'string', required: false },
        };
        const control: ControlEntry = {
            requirements: [{ config: {} }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'req-001',
                        name: 'Required',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ req: control }}
                onUpdate={onUpdate}
                expandControl="req"
            />
        );
        expect(html).toContain('required-prop');
        expect(html).toContain('*'); // Asterisk for required
        expect(html).toContain('optional-prop');
    });

    it('shows property descriptions', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            cipher: {
                type: 'enum',
                allowedValues: ['AES-256', 'AES-128'],
                description: 'Encryption cipher strength',
                required: true,
            },
        };
        const control: ControlEntry = {
            requirements: [{ config: { cipher: 'AES-256' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'enc-001',
                        name: 'Encryption',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ enc: control }}
                onUpdate={onUpdate}
                expandControl="enc"
            />
        );
        expect(html).toContain('Encryption cipher strength');
    });

    it('is readonly when readonly=true (no edit inputs)', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            setting: { type: 'string', required: true },
        };
        const control: ControlEntry = {
            requirements: [{ config: { setting: 'value' } }],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'ro-001',
                        name: 'ReadOnly',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ ro: control }}
                onUpdate={onUpdate}
                readonly={true}
                expandControl="ro"
            />
        );
        // Should show value as text, not input
        expect(html).toContain('value');
        expect(html).not.toContain('type="text"');
        expect(html).not.toContain('<select');
    });

    it('is readonly when config-url is set (pinned config)', () => {
        const onUpdate = vi.fn();
        const properties: Record<string, RequirementPropertyDef> = {
            setting: { type: 'string', required: true },
        };
        const control: ControlEntry = {
            requirements: [
                {
                    'config-url': 'path/to/config.json',
                    config: { setting: 'value' },
                },
            ],
            metadata: {
                validation: {
                    identity: {
                        controlId: 'pin-001',
                        name: 'Pinned',
                        description: 'd',
                    },
                    properties,
                },
            },
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ pin: control }}
                onUpdate={onUpdate}
                expandControl="pin"
            />
        );
        expect(html).toContain('config-url');
        expect(html).toContain('remove it to edit');
        expect(html).toContain('value');
        // Config value is displayed as readonly <p>, not editable input
        expect(html).toContain(
            '<p style="font-size:11px;color:var(--calm-fg-muted);margin:0">value</p>'
        );
    });

    it('shows requirement URLs as links when Hub-sourced', () => {
        const onUpdate = vi.fn();
        const control: ControlEntry = {
            requirements: [
                { 'requirement-url': 'security:controls:encryption@sha123' },
            ],
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ hub: control }}
                onUpdate={onUpdate}
                expandControl="hub"
            />
        );
        expect(html).toContain('security:controls:encryption@sha123');
        // Hub-sourced should be a clickable link
        expect(html).toContain('↗');
    });

    it('shows local requirement URLs as plain text', () => {
        const onUpdate = vi.fn();
        const control: ControlEntry = {
            requirements: [
                { 'requirement-url': 'controls/local.requirement.json' },
            ],
        };
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ local: control }}
                onUpdate={onUpdate}
                expandControl="local"
            />
        );
        expect(html).toContain('controls/local.requirement.json');
    });
});

describe('ControlsList - Regression Tests (Real Fixtures)', () => {
    /**
     * Regression tests using real control fixtures from ap187183-fae-calm-assets repository.
     * These tests verify that controls actually used in production work correctly in the UI.
     */

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders database-technology real control with enum dropdown', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{
                    'database-tech': fixtures.databaseTechnologyControl,
                }}
                onUpdate={onUpdate}
                expandControl="database-tech"
            />
        );
        expect(html).toContain('Database Technology');
        expect(html).toContain('database-technology'); // Control ID from real fixture
        expect(html).toContain('<select'); // Enum type
        expect(html).toContain('AWS Aurora PostgreSQL');
        expect(html).toContain('Snowflake');
        expect(html).toContain('Other');
    });

    it('renders access-token-ttl-minutes real control with integer input', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ ttl: fixtures.accessTokenTtlControl }}
                onUpdate={onUpdate}
                expandControl="ttl"
            />
        );
        expect(html).toContain('Access Token TTL');
        expect(html).toContain('type="number"');
        expect(html).toContain('step="1"'); // Integer
        expect(html).toContain('60');
    });

    it('renders unconfigured database-technology control (required enum not filled)', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{
                    unconfigured: fixtures.databaseTechnologyUnconfigured,
                }}
                onUpdate={onUpdate}
                expandControl="unconfigured"
            />
        );
        expect(html).toContain('<select'); // Still enum type
        expect(html).toContain('— Select —'); // Prompts for selection
        expect(html).toContain('color:#dc2626'); // Red asterisk indicates required
        expect(html).toContain('value="" selected=""'); // No value selected
    });

    it('renders authentication-pattern real control with security options', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ auth: fixtures.authenticationPatternControl }}
                onUpdate={onUpdate}
                expandControl="auth"
            />
        );
        expect(html).toContain('Authentication Pattern');
        expect(html).toContain('<select'); // Enum
        expect(html).toContain('SAML');
        expect(html).toContain('OIDC');
        expect(html).toContain('Kerberos');
    });

    it('renders legacy single-value control with allowed-values metadata', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ legacy: fixtures.legacyEncryptionControl }}
                onUpdate={onUpdate}
                expandControl="legacy"
            />
        );
        expect(html).toContain('Legacy encryption control');
        expect(html).toContain('<select'); // Legacy allowed-values renders as dropdown
        expect(html).toContain('AES-256');
        expect(html).toContain('AES-128');
    });

    it('renders pinned-config control as readonly (config-url locked)', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ pinned: fixtures.pinnedDatabaseControl }}
                onUpdate={onUpdate}
                expandControl="pinned"
            />
        );
        expect(html).toContain('config-url');
        expect(html).toContain('remove it to edit');
        expect(html).toContain('AWS Aurora PostgreSQL');
        // Should be readonly, displayed as text not input
        expect(html).toContain('<p');
    });

    it('renders broken enum control (missing allowedValues) as dropdown', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ broken: fixtures.brokenEnumControl }}
                onUpdate={onUpdate}
                expandControl="broken"
            />
        );
        expect(html).toContain('Broken Enum');
        expect(html).toContain('<select'); // Still rendered as select (type contract)
        expect(html).toContain('— Select —'); // Empty dropdown signals misconfiguration
    });

    it('renders hub-sourced control with CURIE reference', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ hub: fixtures.hubSourcedControl }}
                onUpdate={onUpdate}
                expandControl="hub"
            />
        );
        expect(html).toContain('Database Technology (Hub)');
        expect(html).toContain('<select'); // Enum from Hub
        expect(html).toContain('PostgreSQL');
        expect(html).toContain('↗'); // Hub link indicator
    });

    it('renders pattern control with regex validation hint', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ path: fixtures.patternControl }}
                onUpdate={onUpdate}
                expandControl="path"
            />
        );
        expect(html).toContain('Health Path');
        expect(html).toContain('type="text"');
        expect(html).toContain('Pattern: ^/[a-z]+$'); // Pattern hint shown
        expect(html).toContain('/health');
    });

    it('renders boolean control with three-state select', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ encryption: fixtures.encryptionEnabledControl }}
                onUpdate={onUpdate}
                expandControl="encryption"
            />
        );
        expect(html).toContain('Encryption Enabled');
        expect(html).toContain('<select');
        expect(html).toContain('true');
        expect(html).toContain('false');
        expect(html).toContain('— Select —');
    });

    it('renders decimal number control with step=any', () => {
        const onUpdate = vi.fn();
        const html = renderToStaticMarkup(
            <ControlsList
                controls={{ timeout: fixtures.timeoutControl }}
                onUpdate={onUpdate}
                expandControl="timeout"
            />
        );
        expect(html).toContain('Connection Timeout');
        expect(html).toContain('type="number"');
        expect(html).toContain('step="any"'); // Decimal support
        expect(html).toContain('30.5');
    });
});
