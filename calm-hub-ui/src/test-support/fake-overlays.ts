import type { Decorator, ElementOverlay, OverlayDecoratorView, OverlayStatus, ViewOverlay } from '../visualizer/contracts/contracts.js';
import { isBuiltInExtension } from '../extensions/extensionIdentity.js';

export function fakeView(extensionId: string, viewId = 'risk', name = `Extension ${extensionId}`): OverlayDecoratorView {
    return {
        id: viewId,
        label: `View ${viewId}`,
        match: { type: viewId },
        overlay: { status: '/status', map: { high: 'error', low: 'ok' }, label: '/summary', time: '/at' },
        source: { id: extensionId, name, builtIn: isBuiltInExtension(extensionId) },
    };
}

export const fakeDecorator = (uniqueId: string, data: Record<string, unknown>): Decorator =>
    ({ uniqueId, type: 'risk', target: [], appliesTo: ['n1'], data }) as unknown as Decorator;

export function fakeElement(status: OverlayStatus, entries: ElementOverlay['entries'] = []): ElementOverlay {
    return { status, value: entries[0]?.value ?? status, entries };
}

/** One overlay view per extension, each drawing on node n1. */
export const fakeViewOverlays = (count: number): ViewOverlay[] =>
    Array.from({ length: count }, (_, i) => ({ view: fakeView(`ext-${i + 1}`), elements: new Map([['n1', fakeElement('ok')]]) }));
