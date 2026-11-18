import type { RenderableDecorator } from './DecoratorCard.js';

/**
 * A React key for each card. A unique `uniqueId` keeps a card, and its open view, when the list shifts. The index is
 * only the fallback for a missing or repeated id.
 */
export function decoratorKeys(decorators: readonly RenderableDecorator[]): string[] {
    const counts = new Map<string, number>();
    for (const { uniqueId } of decorators) {
        if (typeof uniqueId === 'string' && uniqueId !== '') counts.set(uniqueId, (counts.get(uniqueId) ?? 0) + 1);
    }
    return decorators.map(({ uniqueId }, index) =>
        typeof uniqueId === 'string' && counts.get(uniqueId) === 1 ? `id:${uniqueId}` : `index:${index}`
    );
}
