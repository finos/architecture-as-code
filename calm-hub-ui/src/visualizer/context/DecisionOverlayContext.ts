import { createContext, useContext } from 'react';

/** The decision overlay, set by the toggle in the diagram's controls. */
export interface DecisionOverlay {
    /** Each evaluated element's latest decision drawn on the diagram, always visible. */
    showDecisions: boolean;
    /** Display names for the diagram's elements by unique-id: a node's label, a relationship's "source → destination". */
    subjectLabels: Map<string, string>;
}

export const DecisionOverlayContext = createContext<DecisionOverlay>({
    showDecisions: false,
    subjectLabels: new Map(),
});

export const useDecisionOverlay = (): DecisionOverlay => useContext(DecisionOverlayContext);
