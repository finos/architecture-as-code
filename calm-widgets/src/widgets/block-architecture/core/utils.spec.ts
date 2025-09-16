import { describe, it, expect } from 'vitest';
import { prettyLabel, labelFor, sanitizeId, ifaceId, pickIface } from './utils';
import {
    CalmNodeCanonicalModel,
    CalmNodeInterfaceCanonicalModel,
} from '@finos/calm-models/canonical';

describe('utils', () => {
    describe('prettyLabel', () => {
        it('converts underscores/hyphens to spaces and Title-Cases words', () => {
            expect(prettyLabel('trade-svc')).toBe('Trade Svc');
            expect(prettyLabel('trading_db')).toBe('Trading Db');
            expect(prettyLabel('multi___dash--and__under')).toBe('Multi Dash And Under');
        });

        it('collapses whitespace and trims', () => {
            expect(prettyLabel('  spaced   text  ')).toBe('Spaced Text');
        });

        it('handles empty string', () => {
            expect(prettyLabel('')).toBe('');
        });
    });

    describe('labelFor', () => {
        it('prefers name', () => {
            const n: CalmNodeCanonicalModel = {
                'unique-id': 'trade-svc',
                'node-type': 'service',
                name: 'Trade Service',
                description: '',
            };
            expect(labelFor(n, 'trade-svc')).toBe('Trade Service');
        });

        it('uses explicit label when present on node shape', () => {
            type WithLabel = CalmNodeCanonicalModel & { label?: string };
            const n: WithLabel = {
                'unique-id': 'x',
                'node-type': 't',
                name: '',
                description: '',
                label: 'Explicit Label',
            };
            expect(labelFor(n, 'x')).toBe('Explicit Label');
        });

        it('falls back to unique-id, then prettyLabel(id)', () => {
            const n: CalmNodeCanonicalModel = {
                'unique-id': 'node-1',
                'node-type': 'db',
                name: '',
                description: '',
            };
            expect(labelFor(n)).toBe('node-1');
            expect(labelFor(undefined, 'some-id')).toBe('Some Id');
            expect(labelFor(undefined)).toBe('');
        });
    });

    describe('sanitizeId', () => {
        it('replaces illegal chars with underscores; keeps ":" and "."', () => {
            expect(sanitizeId('a/b:c?*')).toBe('a_b:c__');
            expect(sanitizeId('name.with.dots')).toBe('name.with.dots');
            expect(sanitizeId('colon:ok')).toBe('colon:ok');
            expect(sanitizeId('white space & symbols')).toBe('white_space___symbols');
        });
    });

    describe('ifaceId', () => {
        it('embeds node id and sanitized iface key', () => {
            const key = 'if:name/path?x=1';
            const expected = `node1__iface__${sanitizeId(key)}`;
            expect(ifaceId('node1', key)).toBe(expected);
        });
    });

    describe('pickIface', () => {
        it('returns first interface when present', () => {
            const ni: CalmNodeInterfaceCanonicalModel = { node: 'n', interfaces: ['alpha', 'beta'] };
            expect(pickIface(ni)).toBe('alpha');
        });

        it('returns undefined when interfaces is empty', () => {
            const ni: CalmNodeInterfaceCanonicalModel = { node: 'n', interfaces: [] };
            expect(pickIface(ni)).toBeUndefined();
        });

        it('returns undefined when interfaces is not provided', () => {
            const ni: CalmNodeInterfaceCanonicalModel = { node: 'n' };
            expect(pickIface(ni)).toBeUndefined();
        });
    });
});
