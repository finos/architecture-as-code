import { describe, it, expect } from 'vitest';
import {
    isCanonicalControlUrl,
    isControlCurie,
    isLocalControlPath,
    isControlRef,
    parseControlCurie,
    parseCanonicalControlUrl,
    makeControlMapKey,
    buildControlCurie,
    stripControlCurieVersion,
} from './control-curie';

const CANONICAL =
    'https://hub.example.com/calm/domains/security/controls/micro-segmentation/requirement/versions/1.0.0';

describe('classification', () => {
    it('isCanonicalControlUrl detects https URLs targeting /calm/domains/', () => {
        expect(isCanonicalControlUrl(CANONICAL)).toBe(true);
        expect(isCanonicalControlUrl('https://example.com/foo')).toBe(false);
        expect(isCanonicalControlUrl('security:controls:x@1.0.0')).toBe(false);
    });

    it('isControlCurie requires :controls: (version optional)', () => {
        expect(isControlCurie('security:controls:micro-segmentation@1.0.0')).toBe(true);
        expect(isControlCurie('security:controls:micro-segmentation')).toBe(true);
        expect(isControlCurie('security:standards:x@sha')).toBe(false);
        expect(isControlCurie('https://h/calm/domains/x/controls/y/requirement/versions/1.0.0')).toBe(false);
    });

    it('isLocalControlPath accepts any relative .json path', () => {
        expect(isLocalControlPath('controls/micro-segmentation.requirement.json')).toBe(true);
        expect(isLocalControlPath('controls/networking/tls.requirement.json')).toBe(true);
        expect(isLocalControlPath('controls/x.json')).toBe(true);
        expect(isLocalControlPath('/abs/controls/x.requirement.json')).toBe(false);
        expect(isLocalControlPath('../x.requirement.json')).toBe(false);
        expect(isLocalControlPath('C:\\controls\\x.requirement.json')).toBe(false);
        expect(isLocalControlPath(CANONICAL)).toBe(false);
        expect(isLocalControlPath('standards/policy.md')).toBe(false);
    });

    it('isControlRef covers all three formats', () => {
        expect(isControlRef(CANONICAL)).toBe(true);
        expect(isControlRef('security:controls:x@1.0.0')).toBe(true);
        expect(isControlRef('controls/x.requirement.json')).toBe(true);
        expect(isControlRef('controls/x.json')).toBe(true);
        expect(isControlRef('not-a-ref')).toBe(false);
    });
});

describe('parseControlCurie', () => {
    it('splits a valid CURIE into parts', () => {
        expect(parseControlCurie('security:controls:micro-segmentation@1.0.0')).toEqual({
            domain: 'security',
            controlName: 'micro-segmentation',
            version: '1.0.0',
        });
    });

    it('accepts dash-separated versions', () => {
        expect(parseControlCurie('security:controls:x@1-0-0')?.version).toBe('1-0-0');
    });

    it('parses an unversioned CURIE (building-block form)', () => {
        expect(parseControlCurie('security:controls:micro-segmentation')).toEqual({
            domain: 'security',
            controlName: 'micro-segmentation',
            version: undefined,
        });
    });

    it('returns null for a non-control CURIE', () => {
        expect(parseControlCurie('security:standards:x@1.0.0')).toBeNull();
    });

    it('returns null for an invalid slug', () => {
        expect(parseControlCurie('security:controls:Bad_Slug@1.0.0')).toBeNull();
    });
});

describe('parseCanonicalControlUrl', () => {
    it('extracts domain, control, and version', () => {
        expect(parseCanonicalControlUrl(CANONICAL)).toEqual({
            domain: 'security',
            controlName: 'micro-segmentation',
            version: '1.0.0',
        });
    });

    it('rejects URLs with query or fragment', () => {
        expect(parseCanonicalControlUrl(CANONICAL + '?x=1')).toBeNull();
        expect(parseCanonicalControlUrl(CANONICAL + '#frag')).toBeNull();
    });

    it('rejects a malformed path', () => {
        expect(
            parseCanonicalControlUrl('https://hub.example.com/calm/domains/security/foo')
        ).toBeNull();
    });
});

describe('makeControlMapKey', () => {
    it('joins domain and control for a Hub CURIE', () => {
        expect(makeControlMapKey('security:controls:micro-segmentation@1.0.0')).toBe(
            'security--micro-segmentation'
        );
    });

    it('joins domain and control for a canonical URL', () => {
        expect(makeControlMapKey(CANONICAL)).toBe('security--micro-segmentation');
    });

    it('uses the stem for a top-level local path', () => {
        expect(makeControlMapKey('controls/micro-segmentation.requirement.json')).toBe(
            'micro-segmentation'
        );
    });

    it('uses the stem for a plain .json local path (no .requirement)', () => {
        expect(makeControlMapKey('controls/tls.json')).toBe('tls');
        expect(makeControlMapKey('controls/networking/tls.json')).toBe('networking--tls');
    });

    it('joins subdirectory segments for a nested local path', () => {
        expect(makeControlMapKey('controls/networking/tls.requirement.json')).toBe(
            'networking--tls'
        );
    });

    it('produces distinct keys for the same slug in different domains', () => {
        expect(makeControlMapKey('security:controls:tls@1.0.0')).not.toBe(
            makeControlMapKey('privacy:controls:tls@1.0.0')
        );
    });

    it('produces distinct keys for the same stem in different subdirectories', () => {
        expect(makeControlMapKey('controls/a/tls.requirement.json')).toBe('a--tls');
        expect(makeControlMapKey('controls/b/tls.requirement.json')).toBe('b--tls');
    });

    it('only emits key characters allowed by the CALM control-map pattern', () => {
        const key = makeControlMapKey('controls/net work/tls.requirement.json');
        expect(key).toMatch(/^[a-zA-Z0-9-]+$/);
    });
});
