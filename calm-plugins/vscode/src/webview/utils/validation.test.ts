import { describe, it, expect } from 'vitest';
import { validateControls, validateControlConfig } from './validation';

const control = (validation: unknown, value?: string) => ({
    requirements: [{ config: value === undefined ? {} : { value } }],
    metadata: { validation },
});

describe('validateControlConfig', () => {
    it('errors (unconfigured) when an allowed-values control has no value', () => {
        const issues = validateControlConfig(
            'api-gw',
            control({ 'allowed-values': ['Stratum', 'AWS API GW'] }),
            '"Svc"',
            'svc-1'
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].message).toContain('not configured');
        expect(issues[0].message).toContain('Stratum');
        expect(issues[0].nodeId).toBe('svc-1');
        expect(issues[0].controlId).toBe('api-gw');
    });

    it('errors when the value is not one of the allowed values', () => {
        const issues = validateControlConfig(
            'api-gw',
            control({ 'allowed-values': ['Stratum'] }, 'Nginx'),
            '"Svc"'
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].message).toContain('not an allowed value');
    });

    it('passes when the value is an allowed value', () => {
        expect(
            validateControlConfig(
                'api-gw',
                control({ 'allowed-values': ['Stratum'] }, 'Stratum'),
                '"Svc"'
            )
        ).toEqual([]);
    });

    it('errors when the value does not match the pattern', () => {
        const issues = validateControlConfig(
            'health',
            control({ pattern: '^/[a-z]+$' }, 'BAD PATH'),
            '"Svc"'
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].message).toContain('does not match required pattern');
    });

    it('passes when the value matches the pattern', () => {
        expect(
            validateControlConfig(
                'health',
                control({ pattern: '^/[a-z]+$' }, '/health'),
                '"Svc"'
            )
        ).toEqual([]);
    });

    it('ignores controls with no validation metadata', () => {
        expect(
            validateControlConfig(
                'x',
                { requirements: [{ config: {} }] },
                '"Svc"'
            )
        ).toEqual([]);
    });

    it('does not crash on a malformed regex pattern', () => {
        expect(
            validateControlConfig(
                'x',
                control({ pattern: '([' }, 'anything'),
                '"Svc"'
            )
        ).toEqual([]);
    });
});

describe('validateControls', () => {
    it('validates controls on every node, including standard nodes', () => {
        const arch = {
            nodes: [
                {
                    'unique-id': 'std-1',
                    'node-type': 'standard',
                    name: 'A Standard',
                    metadata: { 'source-building-block': 'standards:foo' },
                    controls: {
                        'app-id': control({ 'allowed-values': ['x'] }),
                    },
                },
                {
                    'unique-id': 'svc-1',
                    'node-type': 'service',
                    name: 'Microservice',
                    controls: {
                        'api-gateway': control({
                            'allowed-values': ['Stratum'],
                        }),
                        'health-api': control(
                            { pattern: '^/[a-z]+$' },
                            '/actuator'
                        ),
                    },
                },
            ],
            relationships: [],
        } as any;

        const issues = validateControls(arch);
        // The standard's unconfigured app-id AND the service's api-gateway are flagged
        // (health-api has a valid value, so it passes).
        expect(issues).toHaveLength(2);
        expect(
            issues.some((i) => i.controlId === 'app-id' && i.nodeId === 'std-1')
        ).toBe(true);
        expect(
            issues.some(
                (i) => i.controlId === 'api-gateway' && i.nodeId === 'svc-1'
            )
        ).toBe(true);
    });

    it('validates solution-level controls', () => {
        const arch = {
            nodes: [],
            relationships: [],
            controls: {
                'enc-at-rest': control({ 'allowed-values': ['AES256'] }),
            },
        } as any;
        const issues = validateControls(arch);
        expect(issues).toHaveLength(1);
        expect(issues[0].message).toContain('the solution');
    });
});
