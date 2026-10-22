import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { calmSchemaRelease, CALM_META_SCHEMA_BASE_URL, CALM_SCHEMA_RELEASE } from './calm-schema-release';

describe('calmSchemaRelease', () => {
    it('returns the major and minor version', () => {
        expect(calmSchemaRelease('1.2.0')).toBe('1.2');
        expect(calmSchemaRelease('2.10.3')).toBe('2.10');
    });

    it.each(['1.3.0-rc.1', '1.2', 'latest'])('throws for version %s', (version) => {
        expect(() => calmSchemaRelease(version)).toThrow('is not <major>.<minor>.<patch>');
    });
});

describe('CALM_SCHEMA_RELEASE', () => {
    it('matches the installed @finos/calm-schema', () => {
        const { version } = JSON.parse(readFileSync(require.resolve('@finos/calm-schema/package.json'), 'utf8'));
        expect(CALM_SCHEMA_RELEASE).toBe(calmSchemaRelease(version));
        expect(CALM_META_SCHEMA_BASE_URL).toBe(`https://calm.finos.org/release/${CALM_SCHEMA_RELEASE}/meta`);
    });
});
