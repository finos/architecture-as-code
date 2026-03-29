import { describe, it, expect } from 'vitest';
import { formatFieldName, getNodeIcon, extractAigf, getExtraProperties } from './sidebar-utils.js';
import { User, Globe, Box, Cog, Database, Network, Users, Globe2, FileText } from 'lucide-react';

describe('formatFieldName', () => {
    it('capitalises each word separated by hyphens', () => {
        expect(formatFieldName('risk-level')).toBe('Risk Level');
    });

    it('handles single word', () => {
        expect(formatFieldName('name')).toBe('Name');
    });

    it('handles multiple hyphens', () => {
        expect(formatFieldName('some-long-field-name')).toBe('Some Long Field Name');
    });
});

describe('getNodeIcon', () => {
    it.each([
        ['actor', User],
        ['ecosystem', Globe],
        ['system', Box],
        ['service', Cog],
        ['database', Database],
        ['datastore', Database],
        ['data-store', Database],
        ['network', Network],
        ['ldap', Users],
        ['webclient', Globe2],
        ['data-asset', FileText],
        ['interface', Network],
        ['external-service', Globe2],
    ])('returns correct icon for %s', (nodeType, expectedIcon) => {
        expect(getNodeIcon(nodeType)).toBe(expectedIcon);
    });

    it('is case-insensitive', () => {
        expect(getNodeIcon('Actor')).toBe(User);
        expect(getNodeIcon('DATABASE')).toBe(Database);
    });

    it('returns Box as default for unknown types', () => {
        expect(getNodeIcon('unknown-type')).toBe(Box);
    });
});

describe('extractAigf', () => {
    it('returns undefined for null metadata', () => {
        expect(extractAigf(null)).toBeUndefined();
    });

    it('returns undefined for non-object metadata', () => {
        expect(extractAigf('string')).toBeUndefined();
    });

    it('returns undefined for array metadata', () => {
        expect(extractAigf([1, 2])).toBeUndefined();
    });

    it('returns undefined when aigf key is missing', () => {
        expect(extractAigf({ other: 'data' })).toBeUndefined();
    });

    it('extracts aigf data from metadata', () => {
        const aigf = { 'risk-level': 'high', risks: ['risk-1'] };
        expect(extractAigf({ aigf })).toEqual(aigf);
    });
});

describe('getExtraProperties', () => {
    it('filters out known fields', () => {
        const data = { 'unique-id': '1', name: 'test', extra: 'value' };
        const known = new Set(['unique-id', 'name']);
        expect(getExtraProperties(data, known)).toEqual([['extra', 'value']]);
    });

    it('returns empty array when all fields are known', () => {
        const data = { a: 1, b: 2 };
        const known = new Set(['a', 'b']);
        expect(getExtraProperties(data, known)).toEqual([]);
    });

    it('returns all entries when no fields are known', () => {
        const data = { x: 1, y: 2 };
        expect(getExtraProperties(data, new Set())).toEqual([['x', 1], ['y', 2]]);
    });
});
