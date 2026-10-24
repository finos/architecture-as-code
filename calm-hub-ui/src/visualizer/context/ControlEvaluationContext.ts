import { createContext, useContext } from 'react';
import type { ElementEvaluation } from '../contracts/contracts.js';

/**
 * The latest control evaluations for each element of the diagram, keyed by unique-id. Empty unless an architecture
 * from CALM Hub carries control-evaluation decorators.
 */
export const ControlEvaluationContext = createContext<Map<string, ElementEvaluation>>(new Map());

export const useElementEvaluation = (id?: string): ElementEvaluation | undefined => {
    const evaluations = useContext(ControlEvaluationContext);
    return id ? evaluations.get(id) : undefined;
};
