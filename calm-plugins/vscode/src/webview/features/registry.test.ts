import { describe, expect, it } from 'vitest';
import { applyCanvasTransforms, canvasFeatures, dispatchFeatureDrop, getEnabledFeatureDefinitions, getEnabledNodeTypes, notifyRelationshipsDeleted, resolveEnabledFeatures, validateFeatureDefinitions } from './registry';
import type { CanvasFeatureDefinition, CanvasFeatureDropContext } from './types';

describe('canvas feature registry', () => {
    it('enables only registered feature IDs from configuration', () => {
        const enabled = resolveEnabledFeatures(['flows', 'unknown-feature', 'import-export']);

        expect([...enabled]).toEqual(['flows', 'import-export']);
        expect(getEnabledFeatureDefinitions(enabled).map((feature) => feature.id)).toEqual([
            'flows',
            'import-export',
        ]);
    });

    it('keeps optional features disabled when the setting is an empty array', () => {
        expect(resolveEnabledFeatures([]).size).toBe(0);
    });

    it('enables all discovered features when the setting is unset', () => {
        expect(resolveEnabledFeatures(undefined)).toEqual(
            new Set(canvasFeatures.map((feature) => feature.id)),
        );
    });

    it('keeps the core usable when no optional feature folders are bundled', () => {
        expect(resolveEnabledFeatures(undefined, [])).toEqual(new Set());
        expect(resolveEnabledFeatures(['unavailable-feature'], [])).toEqual(new Set());
    });

    it('discovers unique feature definitions from feature folders', () => {
        const featureIds = canvasFeatures.map((feature) => feature.id);
        const actionIds = canvasFeatures.flatMap((feature) => [
            ...(feature.toolbarActions ?? []).map((action) => action.id),
            ...(feature.menuActions ?? []).map((action) => action.id),
        ]);

        expect(featureIds.length).toBeGreaterThan(0);
        expect(new Set(featureIds).size).toBe(featureIds.length);
        expect(new Set(actionIds).size).toBe(actionIds.length);
        expect(featureIds).toContain('default-colors');
    });

    it('rejects duplicate feature and action IDs with useful diagnostics', () => {
        expect(() => validateFeatureDefinitions([
            { id: 'same-feature' },
            { id: 'same-feature' },
        ])).toThrow('Duplicate canvas feature ID: same-feature');

        expect(() => validateFeatureDefinitions([
            { id: 'one', toolbarActions: [{ id: 'duplicate-action', label: 'One', group: 'one', order: 1 }] },
            { id: 'two', menuActions: [{ id: 'duplicate-action', label: 'Two', order: 1 }] },
        ])).toThrow('Duplicate canvas action ID: duplicate-action (feature two)');
    });

    it('uses core node renderers unless an enabled feature contributes an override', () => {
        const coreServiceRenderer = () => null;
        const coreNodeTypes = { service: coreServiceRenderer };

        expect(getEnabledNodeTypes(new Set(), coreNodeTypes).service).toBe(coreServiceRenderer);
        expect(getEnabledNodeTypes(new Set(['node-appearance']), coreNodeTypes).service).not.toBe(coreServiceRenderer);
    });

    it('rejects conflicting enabled feature renderers for the same node type', () => {
        const firstRenderer = () => null;
        const secondRenderer = () => null;
        const definitions: CanvasFeatureDefinition[] = [
            { id: 'first-renderer', nodeTypes: { service: firstRenderer } },
            { id: 'second-renderer', nodeTypes: { service: secondRenderer } },
        ];
        const enabled = new Set(definitions.map((feature) => feature.id));

        expect(() => getEnabledNodeTypes(enabled, {}, definitions)).toThrow(
            'Node renderer collision for "service" between features "first-renderer" and "second-renderer"',
        );
    });

    it('applies canvas transforms from enabled feature definitions only', () => {
        const view = { nodes: [], edges: [] } as const;
        const definitions: CanvasFeatureDefinition[] = [
            { id: 'enabled-transform', transformCanvas: (current) => ({ ...current, edges: [{ id: 'enabled' }] }) },
            { id: 'disabled-transform', transformCanvas: (current) => ({ ...current, edges: [...current.edges, { id: 'disabled' }] }) },
        ];
        const result = applyCanvasTransforms([definitions[0]], view);

        expect(result.edges).toEqual([{ id: 'enabled' }]);
    });

    it('dispatches drops only to enabled feature handlers', () => {
        const calls: string[] = [];
        const definitions: CanvasFeatureDefinition[] = [
            { id: 'enabled-drop', onDrop: () => { calls.push('enabled'); return true; } },
            { id: 'disabled-drop', onDrop: () => { calls.push('disabled'); return true; } },
        ];

        expect(dispatchFeatureDrop(new Set(['enabled-drop']), {} as CanvasFeatureDropContext, definitions)).toBe(true);
        expect(calls).toEqual(['enabled']);
    });

    it('does not run cleanup hooks for disabled features', () => {
        const calls: string[] = [];
        const definitions: CanvasFeatureDefinition[] = [
            { id: 'enabled-cleanup', onRelationshipsDeleted: () => calls.push('enabled') },
            { id: 'disabled-cleanup', onRelationshipsDeleted: () => calls.push('disabled') },
        ];

        notifyRelationshipsDeleted(new Set(['enabled-cleanup']), new Set(['rel-1']), definitions);

        expect(calls).toEqual(['enabled']);
    });
});