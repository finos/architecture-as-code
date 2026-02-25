import { describe, it, expect } from 'vitest';
import { prettyLabel, labelFor, sanitizeId, ifaceId, pickIface, mermaidId } from './utils';
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

    describe('mermaidId', () => {
        it('returns sanitized identifiers for Mermaid', () => {
            expect(mermaidId('my-node')).toBe('my-node');
            expect(mermaidId('service')).toBe('service');
        });

        it('prefixes IDs that are exactly reserved words', () => {
            expect(mermaidId('end')).toBe('node_end');
            expect(mermaidId('graph')).toBe('node_graph');
            expect(mermaidId('subgraph')).toBe('node_subgraph');
            expect(mermaidId('END')).toBe('node_END'); // Case-insensitive check
        });

        it('prefixes IDs that contain reserved words at word boundaries', () => {
            expect(mermaidId('end-user')).toBe('node_end-user');
            expect(mermaidId('my-end-service')).toBe('node_my-end-service');
            expect(mermaidId('graph-node')).toBe('node_graph-node');
            expect(mermaidId('node-end')).toBe('node_node-end');
        });

        it('does not prefix IDs where reserved word is part of a larger word', () => {
            expect(mermaidId('endpoint')).toBe('endpoint');
            expect(mermaidId('backend')).toBe('backend');
            expect(mermaidId('graphql')).toBe('graphql');
        });

        it('sanitizes special characters', () => {
            expect(mermaidId('node/with/slashes')).toBe('node_with_slashes');
            expect(mermaidId('node"with"quotes')).toBe('node_with_quotes');
        });

        it('handles special cases', () => {
            expect(mermaidId('my service!')).toBe('my_service_');
            expect(mermaidId('node:with:colon')).toBe('node:with:colon');
            expect(mermaidId('')).toBe('node_empty');
        });
    });
});
