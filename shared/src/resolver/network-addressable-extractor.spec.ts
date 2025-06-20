import { describe, it, expect } from 'vitest';
import { extractNetworkAddressables } from './network-addressable-extractor.js';

describe('extractNetworkAddressables', () => {
    it('extracts URLs from string values', () => {
        const json = JSON.stringify({
            website: 'http://example.com',
            api: 'https://api.example.org/v1'
        });
        const entries = extractNetworkAddressables(json);
        expect(entries).toEqual(
            expect.arrayContaining([
                { path: 'root.website', key: 'website', value: 'http://example.com' },
                { path: 'root.api', key: 'api', value: 'https://api.example.org/v1' }
            ])
        );
    });

    it('extracts URLs from nested objects and arrays', () => {
        const doc = {
            items: [
                { link: 'http://foo.com' },
                ['https://bar.com', { deep: 'http://deep.example.com' }]
            ],
            'https://in-key.com': 'value'
        };
        const json = JSON.stringify(doc);
        const entries = extractNetworkAddressables(json);
        expect(entries).toEqual(
            expect.arrayContaining([
                { path: 'root.items[0].link', key: 'link', value: 'http://foo.com' },
                { path: 'root.items[1][0]', key: '0', value: 'https://bar.com' },
                { path: 'root.items[1][1].deep', key: 'deep', value: 'http://deep.example.com' },
                { path: 'root.https://in-key.com', key: 'https://in-key.com', value: 'https://in-key.com' }
            ])
        );
    });

    it('throws on invalid JSON input', () => {
        expect(() => extractNetworkAddressables('not a json')).toThrow(/Invalid JSON string provided/);
    });

    it('does not extract when no URLs present', () => {
        const json = JSON.stringify({ a: 1, b: ['x', { c: 'y' }] });
        const entries = extractNetworkAddressables(json);
        expect(entries).toEqual([]);
    });
});
