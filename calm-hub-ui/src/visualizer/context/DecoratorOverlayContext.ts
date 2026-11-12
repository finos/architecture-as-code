import { createContext, useContext, useMemo } from 'react';
import type {
    ControlEvaluationDecorator,
    DecoratorView,
    ElementEvaluation,
    ElementOverlay,
    OverlayDecoratorView,
    ViewOverlay,
} from '../contracts/contracts.js';

/** The id of the built-in view whose decision callouts and hover details read control-evaluation fields. */
export const CONTROL_EVALUATION_VIEW_ID = 'control-evaluation';

/** The decorator views drawn on the diagram. Empty unless an architecture from CALM Hub has matching decorators. */
export interface DecoratorOverlayState {
    /** Each view with at least one element on the diagram, in view order. */
    overlays: ViewOverlay[];
    /** Views the legend has turned off. */
    hiddenViews: ReadonlySet<string>;
    toggleView: (viewId: string) => void;
    /** Opens the full list of a view's decorators. Absent where there is no such list. */
    onOpenView?: (view: DecoratorView) => void;
}

export const DecoratorOverlayContext = createContext<DecoratorOverlayState>({
    overlays: [],
    hiddenViews: new Set(),
    toggleView: () => {},
});

export const useDecoratorOverlays = (): DecoratorOverlayState => useContext(DecoratorOverlayContext);

export interface ShownOverlay {
    view: OverlayDecoratorView;
    overlay: ElementOverlay;
}

/** What each shown view draws on one element, in view order. */
export function useElementOverlays(id?: string): ShownOverlay[] {
    const { overlays, hiddenViews } = useDecoratorOverlays();
    return useMemo(() => {
        if (!id) return [];
        const shown: ShownOverlay[] = [];
        for (const { view, elements } of overlays) {
            const overlay = elements.get(id);
            if (overlay && !hiddenViews.has(view.id)) shown.push({ view, overlay });
        }
        return shown;
    }, [overlays, hiddenViews, id]);
}

/** One element's latest control evaluations, for the details only the control-evaluation view has. */
export function useElementEvaluation(id?: string): ElementEvaluation | undefined {
    const shown = useElementOverlays(id).find(({ view }) => view.id === CONTROL_EVALUATION_VIEW_ID);
    return useMemo(() => shown && {
        status: shown.overlay.status === 'error' ? 'not-met' : 'met',
        latest: shown.overlay.entries.map((entry) => entry.decorator as ControlEvaluationDecorator),
    }, [shown]);
}
