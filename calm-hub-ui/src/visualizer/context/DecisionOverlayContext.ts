import { createContext, useCallback, useContext, useRef, useState } from 'react';

/** A decision callout's width, and how far it reaches below the bottom of its node, in flow units. */
export interface CalloutSize {
    width: number;
    height: number;
}

/** The decision overlay, set by the toggle in the diagram's controls. */
export interface DecisionOverlay {
    /** Each evaluated element's latest decision drawn on the diagram, always visible. */
    showDecisions: boolean;
    /** Display names for the diagram's elements by unique-id: a node's label, a relationship's "source → destination". */
    subjectLabels: Map<string, string>;
    /** The size of each drawn callout, by React Flow node id. Callouts are outside the node bounds React Flow measures. */
    calloutSizes: ReadonlyMap<string, CalloutSize>;
    /** Called by a callout when its size changes, and with undefined when it goes. */
    reportCalloutSize: (nodeId: string, size: CalloutSize | undefined) => void;
}

export const DecisionOverlayContext = createContext<DecisionOverlay>({
    showDecisions: false,
    subjectLabels: new Map(),
    calloutSizes: new Map(),
    reportCalloutSize: () => {},
});

export const useDecisionOverlay = (): DecisionOverlay => useContext(DecisionOverlayContext);

/**
 * The callout sizes for a diagram. `currentCalloutSizes` reads the latest sizes without a dependency on them, for an
 * event handler that must not change identity each time a callout resizes.
 */
export function useCalloutSizes() {
    const latest = useRef<ReadonlyMap<string, CalloutSize>>(new Map());
    const [calloutSizes, setCalloutSizes] = useState<ReadonlyMap<string, CalloutSize>>(() => new Map());
    const reportCalloutSize = useCallback((nodeId: string, size: CalloutSize | undefined) => {
        const old = latest.current.get(nodeId);
        if (size ? old?.width === size.width && old.height === size.height : !old) return;
        const next = new Map(latest.current);
        if (size) next.set(nodeId, size);
        else next.delete(nodeId);
        latest.current = next;
        setCalloutSizes(next);
    }, []);
    const currentCalloutSizes = useCallback(() => latest.current, []);
    return { calloutSizes, reportCalloutSize, currentCalloutSizes };
}
