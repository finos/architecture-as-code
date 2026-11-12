import { describe, expect, it } from 'vitest';
import { containerBorderWidth, containerRoleStyle } from './ContainerNode';

describe('containerBorderWidth', () => {
    it('keeps the base width at normal zoom and when zoomed in', () => {
        expect(containerBorderWidth(1.5, 1)).toBe('1.5px');
        expect(containerBorderWidth(1.5, 2)).toBe('1.5px');
        expect(containerBorderWidth(3, 0.5)).toBe('3px');
    });

    it('keeps at least one screen pixel when zoomed out', () => {
        expect(containerBorderWidth(1.5, 0.5)).toBe('2px');
        expect(containerBorderWidth(1.5, 0.25)).toBe('4px');
    });

    it('keeps the base width for a zoom it cannot use', () => {
        expect(containerBorderWidth(1.5, 0)).toBe('1.5px');
    });
});

describe('containerRoleStyle', () => {
    it('sets the border colour and style for every role, so deselecting keeps the border', () => {
        for (const role of ['default', 'region-primary', 'region-secondary', 'cluster', 'az', 'solution', 'unknown']) {
            const style = containerRoleStyle(role);
            expect(style.borderColor, role).toBeTruthy();
            expect(style.borderStyle, role).toBeTruthy();
        }
    });
});
