import { describe, expect, it } from 'vitest';
import { BUILTIN_MARKER, EXTENSION_MARKER_PALETTE, extensionMarkerColour, isBuiltInExtension } from './extensionIdentity.js';

describe('extension identity', () => {
    it('gives an extension the same palette colour every time', () => {
        expect(extensionMarkerColour('release-tracker')).toBe(extensionMarkerColour('release-tracker'));
        expect(EXTENSION_MARKER_PALETTE).toContain(extensionMarkerColour('release-tracker'));
    });

    it('spreads ten extensions over several colours', () => {
        const colours = new Set(Array.from({ length: 10 }, (_, i) => extensionMarkerColour(`ext-${i + 1}`)));
        expect(colours.size).toBeGreaterThanOrEqual(5);
    });

    it('gives built-in views a neutral marker', () => {
        expect(isBuiltInExtension('deployment')).toBe(true);
        expect(isBuiltInExtension('control-evaluation')).toBe(true);
        expect(isBuiltInExtension('release-tracker')).toBe(false);
        expect(extensionMarkerColour('deployment')).toBe(BUILTIN_MARKER);
    });
});
