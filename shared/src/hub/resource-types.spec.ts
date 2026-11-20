import { describe, expect, it } from 'vitest';
import { hasIntegerRevisions, isValidResourceType, RESOURCE_TYPES } from './resource-types';

describe('resource types', () => {
    it('accepts adrs as a resource type', () => {
        expect(RESOURCE_TYPES).toContain('adrs');
        expect(isValidResourceType('adrs')).toBe(true);
        expect(isValidResourceType('timelines')).toBe(true);
    });

    it('uses integer revisions for ADRs only', () => {
        expect(hasIntegerRevisions('adrs')).toBe(true);
        expect(hasIntegerRevisions('architectures')).toBe(false);
    });
});
