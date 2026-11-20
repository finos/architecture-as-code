import type { CanvasFeatureCanvasView, CanvasFeatureDefinition, CanvasFeatureDropContext, CanvasFeatureId } from './types';
import type { NodeTypes } from 'reactflow';

// Vite expands this glob at build time; adding a feature folder needs no core import change.
const featureModules = import.meta.glob<Record<string, CanvasFeatureDefinition>>('./**/feature.ts', {
    eager: true,
});

export function validateFeatureDefinitions(
    definitions: readonly CanvasFeatureDefinition[],
): readonly CanvasFeatureDefinition[] {
    const featureIds = new Set<string>();
    const actionIds = new Set<string>();

    for (const feature of definitions) {
        if (featureIds.has(feature.id)) {
            throw new Error(`Duplicate canvas feature ID: ${feature.id}`);
        }
        featureIds.add(feature.id);

        for (const action of [...(feature.toolbarActions ?? []), ...(feature.menuActions ?? [])]) {
            if (actionIds.has(action.id)) {
                throw new Error(`Duplicate canvas action ID: ${action.id} (feature ${feature.id})`);
            }
            actionIds.add(action.id);
        }
    }

    return definitions;
}

export const canvasFeatures = validateFeatureDefinitions(
    Object.values(featureModules).flatMap((featureModule) => Object.values(featureModule)),
);

export function resolveEnabledFeatures(
    configured: readonly string[] | undefined,
    definitions: readonly CanvasFeatureDefinition[] = canvasFeatures,
): Set<CanvasFeatureId> {
    const available = new Set(definitions.map((feature) => feature.id));
    if (configured === undefined) return available;

    const requested = new Set(configured);
    return new Set([...requested].filter((id) => available.has(id)));
}

export function getEnabledFeatureDefinitions(enabled: ReadonlySet<CanvasFeatureId>): CanvasFeatureDefinition[] {
    return canvasFeatures.filter((feature) => enabled.has(feature.id));
}

export function getEnabledNodeTypes(
    enabled: ReadonlySet<CanvasFeatureId>,
    coreNodeTypes: NodeTypes,
    definitions: readonly CanvasFeatureDefinition[] = canvasFeatures,
): NodeTypes {
    const contributed: Record<string, CanvasFeatureId> = {};
    const overrides: NodeTypes = {};
    for (const feature of definitions.filter((candidate) => enabled.has(candidate.id))) {
        for (const [nodeType, renderer] of Object.entries(feature.nodeTypes ?? {})) {
            const previousFeature = contributed[nodeType];
            if (previousFeature) {
                throw new Error(`Node renderer collision for "${nodeType}" between features "${previousFeature}" and "${feature.id}"`);
            }
            contributed[nodeType] = feature.id;
            overrides[nodeType] = renderer;
        }
    }
    return { ...coreNodeTypes, ...overrides };
}

export function dispatchFeatureDrop(
    enabled: ReadonlySet<CanvasFeatureId>,
    context: CanvasFeatureDropContext,
    definitions: readonly CanvasFeatureDefinition[] = canvasFeatures,
): boolean {
    // The first feature that claims a payload owns it; otherwise core handles palette node drops.
    return definitions.filter((feature) => enabled.has(feature.id)).some((feature) => feature.onDrop?.(context) === true);
}

export function transformCanvasView(
    enabled: ReadonlySet<CanvasFeatureId>,
    view: CanvasFeatureCanvasView,
): CanvasFeatureCanvasView {
    return applyCanvasTransforms(getEnabledFeatureDefinitions(enabled), view);
}

export function notifyRelationshipsDeleted(
    enabled: ReadonlySet<CanvasFeatureId>,
    relationshipIds: ReadonlySet<string>,
    definitions: readonly CanvasFeatureDefinition[] = canvasFeatures,
): void {
    for (const feature of definitions) {
        if (enabled.has(feature.id)) feature.onRelationshipsDeleted?.(relationshipIds);
    }
}

export function applyCanvasTransforms(
    features: readonly CanvasFeatureDefinition[],
    view: CanvasFeatureCanvasView,
): CanvasFeatureCanvasView {
    return features.reduce((current, feature) => feature.transformCanvas?.(current) ?? current, view);
}