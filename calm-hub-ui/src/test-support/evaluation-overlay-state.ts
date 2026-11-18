import type { DecoratorOverlayState } from '../visualizer/context/DecoratorOverlayContext.js';
import { BUILTIN_DECORATOR_VIEWS } from './decorator-views.js';
import type { ElementEvaluation, ElementOverlay, OverlayDecoratorView } from '../visualizer/contracts/contracts.js';

const evaluationView = BUILTIN_DECORATOR_VIEWS.find((v) => v.id === 'control-evaluation') as OverlayDecoratorView;

/** The overlay state the control-evaluation view would give for these element evaluations. */
export function evaluationOverlayState(evaluations: Map<string, ElementEvaluation>): DecoratorOverlayState {
    const elements = new Map<string, ElementOverlay>();
    for (const [id, { status, latest }] of evaluations) {
        elements.set(id, {
            status: status === 'not-met' ? 'error' : 'ok',
            value: status,
            entries: latest.map((decorator) => ({
                decorator,
                value: decorator.data.status,
                status: decorator.data.status === 'not-met' ? 'error' : 'ok',
                label: decorator.data.control?.['unique-id'],
            })),
        });
    }
    return {
        overlays: elements.size ? [{ view: evaluationView, elements }] : [],
        hiddenViews: new Set(),
        toggleView: () => {},
    };
}
