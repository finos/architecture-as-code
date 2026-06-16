import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import {
    collectGettingStartedUrlsFromFile,
    isOptionalGettingStartedUrl,
    loadGettingStartedMapping,
    resolveLocalPathForUrl,
} from './getting-started-url-mapping';

let tempDir: string;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'url-mapping-test-'));
});

afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('collectGettingStartedUrlsFromFile', () => {
    it('walks an architecture and extracts getting-started URLs from strings, arrays, and nested objects', () => {
        const arch = {
            url: 'https://calm.finos.org/getting-started/intro',
            unrelated: 'https://example.com/other',
            nested: {
                a: ['https://calm.finos.org/getting-started/a', null, 42, undefined],
                b: { c: 'https://calm.finos.org/getting-started/b' },
            },
        };
        const file = path.join(tempDir, 'arch.json');
        fs.writeFileSync(file, JSON.stringify(arch));

        const urls = new Set<string>();
        collectGettingStartedUrlsFromFile(file, urls);

        expect([...urls].sort()).toEqual([
            'https://calm.finos.org/getting-started/a',
            'https://calm.finos.org/getting-started/b',
            'https://calm.finos.org/getting-started/intro',
        ]);
    });

    it('throws a wrapped error when the file does not exist', () => {
        const missing = path.join(tempDir, 'does-not-exist.json');
        expect(() => collectGettingStartedUrlsFromFile(missing, new Set())).toThrow(
            /Failed to read or parse JSON from file/i
        );
    });

    it('throws a wrapped error when the file contains invalid JSON', () => {
        const file = path.join(tempDir, 'bad.json');
        fs.writeFileSync(file, '{not-json');
        expect(() => collectGettingStartedUrlsFromFile(file, new Set())).toThrow(
            /Failed to read or parse JSON from file/i
        );
    });
});

describe('loadGettingStartedMapping', () => {
    it('returns the parsed mapping object', () => {
        const file = path.join(tempDir, 'map.json');
        fs.writeFileSync(file, JSON.stringify({ 'https://x': './rel.json' }));
        expect(loadGettingStartedMapping(file)).toEqual({ 'https://x': './rel.json' });
    });

    it('throws a wrapped error when the mapping file is unreadable', () => {
        const file = path.join(tempDir, 'missing.json');
        expect(() => loadGettingStartedMapping(file)).toThrow(
            /Failed to read or parse JSON from mapping file/i
        );
    });
});

describe('resolveLocalPathForUrl', () => {
    it('resolves a URL to an absolute path against the mapping file directory', () => {
        const mappingPath = path.join(tempDir, 'sub', 'mapping.json');
        const resolved = resolveLocalPathForUrl(
            'https://calm.finos.org/getting-started/a',
            { 'https://calm.finos.org/getting-started/a': '../assets/a.json' },
            mappingPath
        );
        expect(resolved).toBe(path.resolve(tempDir, 'assets', 'a.json'));
    });

    it('returns undefined when the URL is not in the mapping', () => {
        expect(
            resolveLocalPathForUrl('https://calm.finos.org/getting-started/missing', {})
        ).toBeUndefined();
    });
});

describe('isOptionalGettingStartedUrl', () => {
    it('marks flows URLs as optional', () => {
        expect(
            isOptionalGettingStartedUrl('https://calm.finos.org/getting-started/flows/x.json')
        ).toBe(true);
    });

    it('treats non-flows getting-started URLs as required', () => {
        expect(
            isOptionalGettingStartedUrl('https://calm.finos.org/getting-started/intro')
        ).toBe(false);
    });
});
