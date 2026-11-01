import { describe, it, expect } from 'vitest';
import { validateControls, validateControlConfig } from './validation';
import type { ParsedRequirement, PropertyMetadata } from '../../extension/services/requirement-parser';

const REQ_URL = 'controls/test.requirement.json';

const makeControl = (
    config: Record<string, unknown> = {},
    reqUrl: string = REQ_URL
) => ({
    requirements: [{ 'requirement-url': reqUrl, config }],
});

const makeResolvedFromProps = (
    properties: Record<string, PropertyMetadata>,
    reqUrl: string = REQ_URL
): Record<string, ParsedRequirement> => ({
    [reqUrl]: {
        identity: { controlId: 'c', name: 'n', description: 'd' },
        properties,
    },
});

const makeResolvedFromSchema = (
    schema: Record<string, unknown>,
    reqUrl: string = REQ_URL
): Record<string, ParsedRequirement> => ({
    [reqUrl]: {
        identity: { controlId: 'c', name: 'n', description: 'd' },
        properties: {},
        schema,
    },
});

describe('validateControlConfig (requirement JSON Schema)', () => {
    it('errors when a required property has no value', () => {
        const resolved = makeResolvedFromProps({
            'permit-ingress': { type: 'boolean', required: true },
        });
        const issues = validateControlConfig(
            'seg',
            makeControl({}),
            '"Svc"',
            'svc-1',
            resolved
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].nodeId).toBe('svc-1');
        expect(issues[0].controlId).toBe('seg');
        expect(issues[0].message).toContain('permit-ingress');
        expect(issues[0].message).toContain('required');
    });

    it('does not error for a missing optional property', () => {
        const resolved = makeResolvedFromProps({
            reason: { type: 'string', required: false },
        });
        expect(
            validateControlConfig('seg', makeControl({}), '"Svc"', undefined, resolved)
        ).toEqual([]);
    });

    it('accepts false and 0 as present values', () => {
        const resolved = makeResolvedFromProps({
            'permit-ingress': { type: 'boolean', required: true },
            retries: { type: 'integer', required: true },
        });
        const issues = validateControlConfig(
            'seg',
            makeControl({ 'permit-ingress': false, retries: 0 }),
            '"Svc"',
            undefined,
            resolved
        );
        expect(issues).toEqual([]);
    });

    it('errors when an enum value is not allowed', () => {
        const resolved = makeResolvedFromProps({
            protocol: {
                type: 'enum',
                allowedValues: ['HTTP', 'HTTPS'],
                required: true,
            },
        });
        const issues = validateControlConfig(
            'seg',
            makeControl({ protocol: 'FTP' }),
            '"Svc"',
            undefined,
            resolved
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain('not allowed');
        expect(issues[0].message).toContain('HTTP');
    });

    it('passes when the enum value is allowed', () => {
        const resolved = makeResolvedFromProps({
            protocol: {
                type: 'enum',
                allowedValues: ['Stratum', 'AWS API GW'],
                required: true,
            },
        });
        expect(
            validateControlConfig(
                'api-gw',
                makeControl({ protocol: 'Stratum' }),
                '"Svc"',
                undefined,
                resolved
            )
        ).toEqual([]);
    });

    it('errors when a string property violates its pattern', () => {
        const resolved = makeResolvedFromProps({
            'app-id': { type: 'string', pattern: '^AP\\d+$', required: true },
        });
        const issues = validateControlConfig(
            'seg',
            makeControl({ 'app-id': 'nope' }),
            '"Svc"',
            undefined,
            resolved
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain('does not match pattern');
    });

    it('passes when a string property matches its pattern', () => {
        const resolved = makeResolvedFromProps({
            health: { type: 'string', pattern: '^/[a-z]+$', required: true },
        });
        expect(
            validateControlConfig(
                'health',
                makeControl({ health: '/actuator' }),
                '"Svc"',
                undefined,
                resolved
            )
        ).toEqual([]);
    });

    it('errors when an integer property is not a whole number', () => {
        const resolved = makeResolvedFromProps({
            retries: { type: 'integer', required: true },
        });
        const issues = validateControlConfig(
            'seg',
            makeControl({ retries: 1.5 }),
            '"Svc"',
            undefined,
            resolved
        );
        expect(issues.some((i) => i.message.includes('integer'))).toBe(true);
    });

    it('validates against full JSON Schema including $defs/$ref and numeric bounds', () => {
        const resolved = makeResolvedFromSchema({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $defs: {
                PortNumber: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 65535,
                },
            },
            type: 'object',
            required: ['port'],
            properties: {
                'control-id': { const: 'net-001' },
                port: { $ref: '#/$defs/PortNumber' },
            },
        });

        // Out-of-range port should fail JSON Schema validation
        const badIssues = validateControlConfig(
            'net',
            makeControl({ 'control-id': 'net-001', port: 70000 }),
            '"Svc"',
            'svc-1',
            resolved
        );
        expect(badIssues).toHaveLength(1);
        expect(badIssues[0].message).toContain('port');

        // Valid port passes
        const goodIssues = validateControlConfig(
            'net',
            makeControl({ 'control-id': 'net-001', port: 443 }),
            '"Svc"',
            'svc-1',
            resolved
        );
        expect(goodIssues).toEqual([]);
    });

    it('ignores controls with no resolved requirement schema', () => {
        expect(
            validateControlConfig(
                'x',
                { requirements: [{ config: {} }] },
                '"Svc"',
                undefined,
                {}
            )
        ).toEqual([]);
    });

    it('ignores controls that use an external config-url instead of inline config', () => {
        const resolved = makeResolvedFromProps({
            'permit-ingress': { type: 'boolean', required: true },
        });
        expect(
            validateControlConfig(
                'seg',
                {
                    requirements: [
                        {
                            'requirement-url': REQ_URL,
                            'config-url': 'controls/seg.config.json',
                        },
                    ],
                },
                '"Svc"',
                undefined,
                resolved
            )
        ).toEqual([]);
    });

    it('does not crash on a malformed schema', () => {
        const resolved = makeResolvedFromSchema({
            type: 'object',
            properties: {
                x: { type: 'string', pattern: '([' },
            },
        });
        expect(
            validateControlConfig(
                'x',
                makeControl({ x: 'anything' }),
                '"Svc"',
                undefined,
                resolved
            )
        ).toEqual([]);
    });

    it('passes when all properties are valid', () => {
        const resolved = makeResolvedFromProps({
            'permit-ingress': { type: 'boolean', required: true },
            protocol: {
                type: 'enum',
                allowedValues: ['HTTP'],
                required: true,
            },
        });
        expect(
            validateControlConfig(
                'seg',
                makeControl({ 'permit-ingress': true, protocol: 'HTTP' }),
                '"Svc"',
                undefined,
                resolved
            )
        ).toEqual([]);
    });
});

describe('validateControls', () => {
    const resolved: Record<string, ParsedRequirement> = {
        'controls/app-id.json': {
            identity: { controlId: 'app-id', name: 'App ID', description: '' },
            properties: {
                value: { type: 'enum', allowedValues: ['x'], required: true },
            },
        },
        'controls/api-gw.json': {
            identity: { controlId: 'api-gw', name: 'API GW', description: '' },
            properties: {
                gateway: {
                    type: 'enum',
                    allowedValues: ['Stratum'],
                    required: true,
                },
            },
        },
        'controls/health.json': {
            identity: { controlId: 'health', name: 'Health', description: '' },
            properties: {
                path: { type: 'string', pattern: '^/[a-z]+$', required: true },
            },
        },
    };

    it('validates controls on every node', () => {
        const arch = {
            nodes: [
                {
                    'unique-id': 'db-1',
                    'node-type': 'database',
                    name: 'Order DB',
                    controls: {
                        'app-id': makeControl({}, 'controls/app-id.json'),
                    },
                },
                {
                    'unique-id': 'svc-1',
                    'node-type': 'service',
                    name: 'Microservice',
                    controls: {
                        'api-gateway': makeControl({}, 'controls/api-gw.json'),
                        'health-api': makeControl(
                            { path: '/actuator' },
                            'controls/health.json'
                        ),
                    },
                },
            ],
            relationships: [],
        } as any;

        const issues = validateControls(arch, resolved);
        // The database's unconfigured app-id AND the service's api-gateway are flagged
        // (health-api has a valid value, so it passes).
        expect(issues).toHaveLength(2);
        expect(
            issues.some((i) => i.controlId === 'app-id' && i.nodeId === 'db-1')
        ).toBe(true);
        expect(
            issues.some(
                (i) => i.controlId === 'api-gateway' && i.nodeId === 'svc-1'
            )
        ).toBe(true);
    });

    it('validates architecture-level controls', () => {
        const arch = {
            nodes: [],
            relationships: [],
            controls: {
                'enc-at-rest': makeControl({}, 'controls/app-id.json'),
            },
        } as any;
        const issues = validateControls(arch, resolved);
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain('the architecture');
    });
});
